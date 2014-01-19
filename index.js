var tic = require('tic')();
var createAtlas = require('atlaspack');
var isTransparent = require('opaque').transparent;
var touchup = require('touchup');

module.exports = function(game, opts) {
  opts = opts || {};
    
  opts.useAtlas = (opts.useAtlas === undefined) ? true : opts.useAtlas;

  if (opts.useAtlas)
    return new Texture(game, opts);
  else
    return new TextureSimple(game, opts);
};

function reconfigure(old) {
  var ret = module.exports(old.game, old.opts);
  ret.load(old.names);

  return ret;
}

function Texture(game, opts) {
  if (!(this instanceof Texture)) return new Texture(game, opts || {});
  var self = this;
  this.game = game;
  this.opts = opts;
  this.THREE = this.game.THREE;
  this.names = [];
  this.materials = [];
  this.transparents = [];
  this.artPacks = opts.artPacks;
  if (!this.artPacks) throw new Error('voxel-texture requires artPacks option');
  this.loading = 0;
  this.ao = require('voxel-fakeao')(this.game);

  var useFlatColors = opts.materialFlatColor === true;
  delete opts.materialFlatColor;

  this.useFourTap = opts.useFourTap === undefined ? true : opts.useFourTap;

  // create a canvas for the texture atlas
  this.canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : {};
  this.canvas.width = opts.atlasWidth || 512;
  this.canvas.height = opts.atlasHeight || 512;
  var ctx = this.canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

  // create core atlas and texture
  this.atlas = createAtlas(this.canvas);
  this.atlas.tilepad = !this.useFourTap; // for 4-tap, not using tilepad since it repeats only half on each side (.5 .5 .5 / .5 1 .5 / .5 .5 .5, not 1 1 / 1 1)
  this._atlasuv = false;
  this._atlaskey = false;
  this.texture = new this.THREE.Texture(this.canvas);

  var THREE = this.game.THREE;

  this.options = {
    crossOrigin: 'Anonymous',
    materialParams: {
      ambient: 0xbbbbbb,
      transparent: false,
      side: THREE.DoubleSide,


    // based on three.js/src/renderers/WebGLShaders.js lambert
		uniforms: THREE.UniformsUtils.merge( [

        THREE.UniformsLib[ "common" ],
        THREE.UniformsLib[ "fog" ],
        THREE.UniformsLib[ "lights" ],
        THREE.UniformsLib[ "shadowmap" ],

        {
          "ambient"  : { type: "c", value: new THREE.Color( 0xffffff ) },
          "emissive" : { type: "c", value: new THREE.Color( 0x000000 ) },
          "wrapRGB"  : { type: "v3", value: new THREE.Vector3( 1, 1, 1 ) },

          // ours
          tileMap: {type: 't', value: null}, // textures not preserved by UniformsUtils.merge(); set below instead
          tileSize: {type: 'f', value: 16.0 / this.canvas.width} // size of tile in UV units (0.0-1.0), square (=== 16.0 / this.canvas.height)
        }
		] ),

		vertexShader: [

			"#define LAMBERT",

			"varying vec3 vLightFront;",

			"#ifdef DOUBLE_SIDED",

				"varying vec3 vLightBack;",

			"#endif",

			THREE.ShaderChunk[ "map_pars_vertex" ],
			THREE.ShaderChunk[ "lightmap_pars_vertex" ],
			THREE.ShaderChunk[ "envmap_pars_vertex" ],
			THREE.ShaderChunk[ "lights_lambert_pars_vertex" ],
			THREE.ShaderChunk[ "color_pars_vertex" ],
			THREE.ShaderChunk[ "morphtarget_pars_vertex" ],
			THREE.ShaderChunk[ "skinning_pars_vertex" ],
			THREE.ShaderChunk[ "shadowmap_pars_vertex" ],

      // added to pass to fragment shader for tile UV coordinate calculation
      'varying vec3 vNormal;',
      'varying vec3 vPosition;',
      'varying vec2 vUv;',
			"void main() {",

				THREE.ShaderChunk[ "map_vertex" ],
				THREE.ShaderChunk[ "lightmap_vertex" ],
				THREE.ShaderChunk[ "color_vertex" ],

				THREE.ShaderChunk[ "morphnormal_vertex" ],
				THREE.ShaderChunk[ "skinbase_vertex" ],
				THREE.ShaderChunk[ "skinnormal_vertex" ],
				THREE.ShaderChunk[ "defaultnormal_vertex" ],

				THREE.ShaderChunk[ "morphtarget_vertex" ],
				THREE.ShaderChunk[ "skinning_vertex" ],
				THREE.ShaderChunk[ "default_vertex" ],

				THREE.ShaderChunk[ "worldpos_vertex" ],
				THREE.ShaderChunk[ "envmap_vertex" ],
				THREE.ShaderChunk[ "lights_lambert_vertex" ],
				THREE.ShaderChunk[ "shadowmap_vertex" ],

        // added
'   vNormal = normal;',
'   vPosition = position;',
'   vUv = uv;',  // passed in from three.js vertexFaceUvs TODO: let shader chunks do it for us (proper #defines)
'   gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
			"}"

		].join("\n"),

		fragmentShader: [

			"uniform float opacity;",

			"varying vec3 vLightFront;",

			"#ifdef DOUBLE_SIDED",

				"varying vec3 vLightBack;",

			"#endif",

			THREE.ShaderChunk[ "color_pars_fragment" ],
			THREE.ShaderChunk[ "map_pars_fragment" ],
			THREE.ShaderChunk[ "lightmap_pars_fragment" ],
			THREE.ShaderChunk[ "envmap_pars_fragment" ],
			THREE.ShaderChunk[ "fog_pars_fragment" ],
			THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
			THREE.ShaderChunk[ "specularmap_pars_fragment" ],

      // added
'uniform sampler2D tileMap;',
'uniform float tileSize;', // Size of a tile in atlas
'',
'varying vec3 vNormal;',
'varying vec3 vPosition;',
'varying vec2 vUv;',

// based on @mikolalysenko's code at:
// http://0fps.wordpress.com/2013/07/09/texture-atlases-wrapping-and-mip-mapping/
// https://github.com/mikolalysenko/ao-shader/blob/master/lib/ao.fsh
// https://github.com/mikolalysenko/ao-shader/blob/master/lib/ao.vsh

'vec4 fourTapSample(vec2 tileOffset, //Tile offset in the atlas ',
'                  vec2 tileUV, //Tile coordinate (as above)',
'                  sampler2D atlas) {',
'  //Initialize accumulators',
'  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);',
'  float totalWeight = 0.0;',
'',
'  for(int dx=0; dx<2; ++dx)',
'  for(int dy=0; dy<2; ++dy) {',
'    //Compute coordinate in 2x2 tile patch',
'    vec2 tileCoord = 2.0 * fract(0.5 * (tileUV + vec2(dx,dy)));',
'',
'    //Weight sample based on distance to center',
'    float w = pow(1.0 - max(abs(tileCoord.x-1.0), abs(tileCoord.y-1.0)), 16.0);',
'',
'    //Compute atlas coord',
'    vec2 atlasUV = tileOffset + tileSize * tileCoord;',
'',
'    //Sample and accumulate',
'    color += w * texture2D(atlas, atlasUV);',
'    totalWeight += w;',
'  }',
'',
'  //Return weighted color',
'  return color / totalWeight;',
'}',
'',

			"void main() {",

				//"gl_FragColor = vec4( vec3 ( 1.0 ), opacity );",

				//THREE.ShaderChunk[ "map_fragment" ],
      
        // added
// use world coordinates to repeat [0..1] offsets, within _each_ tile face
'   vec2 tileUV = vec2(dot(vNormal.zxy, vPosition),',
'                      dot(vNormal.yzx, vPosition));',

'',
'    // back and bottom: flip 180',
'    if (vNormal.z < 0.0 || vNormal.y < 0.0) tileUV.t = 1.0 - tileUV.t;',
'',
'    // left: rotate 90 ccw',
'    if (vNormal.x < 0.0) {',
'        float r = tileUV.s;',
'        tileUV.s = tileUV.t;',
'        tileUV.t = 1.0 - r;',
'    }',
'',
'    // right and top: rotate 90 cw',
'    if (vNormal.x > 0.0 || vNormal.y > 0.0) {',
'        float r = tileUV.s;',
'        tileUV.s = tileUV.t;',
'        tileUV.t = r;',
'    }', 
'',
'    // front and back and bottom: flip 180',
'   if (vNormal.z > 0.0 || vNormal.z < 0.0 || vNormal.y < 0.0) tileUV.s = 1.0 - tileUV.s;',
'',
'',

// three.js' UV coordinate is passed as tileOffset, starting point determining the texture
// material type (_not_ interpolated; same for all vertices).
'   vec2 tileOffset = vUv;',

'',
(this.useFourTap // TODO: use glsl conditional compilation?
  ? [
    '     gl_FragColor = fourTapSample(tileOffset, //Tile offset in the atlas ',
    '                  tileUV, //Tile coordinate (as above)',
    '                  tileMap);'].join('\n') 
  : [
    // index tile at offset into texture atlas
    'vec2 texCoord = tileOffset + tileSize * fract(tileUV);',
    'gl_FragColor = texture2D(tileMap, texCoord);'].join('\n')),
'',
'   if (gl_FragColor.a < 0.001) discard; // transparency',


				THREE.ShaderChunk[ "alphatest_fragment" ],
				THREE.ShaderChunk[ "specularmap_fragment" ],

				"#ifdef DOUBLE_SIDED",

					"if ( gl_FrontFacing )",
						"gl_FragColor.xyz *= vLightFront;",
					"else",
						"gl_FragColor.xyz *= vLightBack;",

				"#else",

					"gl_FragColor.xyz *= vLightFront;",

				"#endif",

				THREE.ShaderChunk[ "lightmap_fragment" ],
				THREE.ShaderChunk[ "color_fragment" ],
				THREE.ShaderChunk[ "envmap_fragment" ],
				THREE.ShaderChunk[ "shadowmap_fragment" ],

				THREE.ShaderChunk[ "linear_to_gamma_fragment" ],

				THREE.ShaderChunk[ "fog_fragment" ],

      "}"
		].join("\n")
	},

    materialTransparentParams: {
      ambient: 0xbbbbbb,
      transparent: true,
      side: this.THREE.DoubleSide,
      //depthWrite: false,
      //depthTest: false
      // TODO
    }
  };

  this.options.materialParams.lights = []; // force lights refresh to setup uniforms, three.js WebGLRenderer line 4323
  this.options.materialParams.uniforms.tileMap.value = this.texture;
  this.texture.magFilter = this.THREE.NearestFilter;
  this.texture.minFilter = this.THREE.LinearMipMapLinearFilter;

  if (useFlatColors) {
    // If were using simple colors
    this.material = new this.THREE.MeshBasicMaterial({
      vertexColors: this.THREE.VertexColors
    });
  } else {
    var opaque = new this.THREE.ShaderMaterial(this.options.materialParams);
    var transparent = new this.THREE.ShaderMaterial(this.options.materialTransparentParams);
    this.material = new this.THREE.MeshFaceMaterial([
      opaque,
      transparent
    ]);
  }

  // a place for meshes to wait while textures are loading
  this._meshQueue = [];
}

Texture.prototype.reconfigure = function() {
  return reconfigure(this);
};

Texture.prototype.load = function(names, done) {
  if (!names || names.length === 0) return;
  this.names = this.names.concat(names); // save for reconfiguration

  var self = this;
  if (!Array.isArray(names)) names = [names];
  done = done || function() {};
  this.loading++;

  var materialSlice = names.map(self._expandName);
  self.materials = self.materials.concat(materialSlice);

  // load onto the texture atlas
  var load = Object.create(null);
  materialSlice.forEach(function(mats) {
    mats.forEach(function(mat) {
      if (mat.slice(0, 1) === '#') return;
      // todo: check if texture already exists
      load[mat] = true;
    });
  });
  if (Object.keys(load).length > 0) {
    each(Object.keys(load), self.pack.bind(self), function() {
      self._afterLoading();
      done(materialSlice);
    });
  } else {
    self._afterLoading();
  }
};

Texture.prototype.getMesh = function() {
  return this.material;
}

Texture.prototype.pack = function(name, done) {
  var self = this;
  function pack(img) {
    var node = self.atlas.pack(img);
    if (node === false) {
      self.atlas = self.atlas.expand(img);
      self.atlas.tilepad = true;
    }
    done();
  }
  if (typeof name === 'string') {
    self.artPacks.getTextureImage(name, function(img) {
      if (isTransparent(img)) {
        self.transparents.push(name);
      }
      // repeat 2x2 for mipmap padding 4-tap trick
      // TODO: replace with atlaspack padding, but changed to 2x2: https://github.com/deathcap/atlaspack/tree/tilepadamount
      var img2 = new Image();
      img2.id = name;
      img2.src = touchup.repeat(img, 2, 2);
      img2.onload = function() {
        pack(img2);
      }
    }, function(err, img) {
      console.error('Couldn\'t load URL [' + img.src + ']');
      done();
    });
  } else {
    pack(name);
  }
  return self;
};

Texture.prototype.find = function(name) {
  var self = this;
  var type = 0;
  self.materials.forEach(function(mats, i) {
    mats.forEach(function(mat) {
      if (mat === name) {
        type = i + 1;
        return false;
      }
    });
    if (type !== 0) return false;
  });
  return type;
};

Texture.prototype.findIndex = Texture.prototype.find; // compatibility

Texture.prototype._expandName = function(name) {
  if (name === null) return Array(6);
  if (name.top) return [name.back, name.front, name.top, name.bottom, name.left, name.right];
  if (!Array.isArray(name)) name = [name];
  // load the 0 texture to all
  if (name.length === 1) name = [name[0],name[0],name[0],name[0],name[0],name[0]];
  // 0 is top/bottom, 1 is sides
  if (name.length === 2) name = [name[1],name[1],name[0],name[0],name[1],name[1]];
  // 0 is top, 1 is bottom, 2 is sides
  if (name.length === 3) name = [name[2],name[2],name[0],name[1],name[2],name[2]];
  // 0 is top, 1 is bottom, 2 is front/back, 3 is left/right
  if (name.length === 4) name = [name[2],name[2],name[0],name[1],name[3],name[3]];
  return name;
};

Texture.prototype._afterLoading = function() {
  var self = this;
  function alldone() {
    self.loading--;
    self._atlasuv = self.atlas.uv(self.canvas.width, self.canvas.height);
    self._atlaskey = Object.create(null);
    self.atlas.index().forEach(function(key) {
      self._atlaskey[key.name] = key;
    });
    self.texture.needsUpdate = true;
    self.material.needsUpdate = true;
    //window.open(self.canvas.toDataURL());
    if (self._meshQueue.length > 0) {
      self._meshQueue.forEach(function(queue, i) {
        self.paint.apply(queue.self, queue.args);
        delete self._meshQueue[i];
      });
    }
  }
  self._powerof2(function() {
    setTimeout(alldone, 100);
  });
};

// Ensure the texture stays at a power of 2 for mipmaps
// this is cheating :D
Texture.prototype._powerof2 = function(done) {
  var w = this.canvas.width;
  var h = this.canvas.height;
  function pow2(x) {
    x--;
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    x++;
    return x;
  }
  if (h > w) w = h;
  var old = this.canvas.getContext('2d').getImageData(0, 0, this.canvas.width, this.canvas.height);
  this.canvas.width = this.canvas.height = pow2(w);
  this.canvas.getContext('2d').putImageData(old, 0, 0);
  done();
};

Texture.prototype.paintMesh = function(mesh) {
  this.paint(mesh);
};

Texture.prototype.paint = function(mesh, materials) {
  var self = this;

  // if were loading put into queue
  if (self.loading > 0) {
    self._meshQueue.push({self: self, args: arguments});
    return false;
  }

  var isVoxelMesh = (materials) ? false : true;
  if (!isVoxelMesh) materials = self._expandName(materials);

  mesh.geometry.faces.forEach(function(face, i) {
    if (mesh.geometry.faceVertexUvs[0].length < 1) return;

    if (isVoxelMesh) {
      var index = Math.floor(face.color.b*255 + face.color.g*255*255 + face.color.r*255*255*255);
      materials = self.materials[index - 1];
      if (!materials) materials = self.materials[0];
    }

    // BACK, FRONT, TOP, BOTTOM, LEFT, RIGHT
    var name = materials[0] || '';
    if      (face.normal.z === 1)  name = materials[1] || '';
    else if (face.normal.y === 1)  name = materials[2] || '';
    else if (face.normal.y === -1) name = materials[3] || '';
    else if (face.normal.x === -1) name = materials[4] || '';
    else if (face.normal.x === 1)  name = materials[5] || '';

    // if just a simple color
    if (name.slice(0, 1) === '#') {
      self.ao(face, name);
      return;
    }

    var atlasuv = self._atlasuv[name];
    if (!atlasuv) return;

    // If a transparent texture use transparent material
    face.materialIndex = 0; //(self.transparents.indexOf(name) !== -1) ? 1 : 0; // XXX: always use same material TODO: do we need separate opaque/transparent?

    // 0 -- 1
    // |    |
    // 3 -- 2
    // faces on these meshes are flipped vertically, so we map in reverse
    if (isVoxelMesh) {
      atlasuv = uvinvert(atlasuv);
    } else {
      atlasuv = uvrot(atlasuv, -90);
    }

    // range of UV coordinates for this texture (see above diagram)
    var topUV = atlasuv[0], rightUV = atlasuv[1], bottomUV = atlasuv[2], leftUV = atlasuv[3];

    // pass texture start in UV coordinates
    for (var j = 0; j < mesh.geometry.faceVertexUvs[0][i].length; j++) {
      //mesh.geometry.faceVertexUvs[0][i][j].set(atlasuv[j][0], 1 - atlasuv[j][1]);
      mesh.geometry.faceVertexUvs[0][i][j].set(topUV[0], 1.0 - topUV[1]); // set all to top (fixed tileSize)
    }
  });

  mesh.geometry.uvsNeedUpdate = true;
};

Texture.prototype.sprite = function(name, w, h, cb) {
  var self = this;
  if (typeof w === 'function') { cb = w; w = null; }
  if (typeof h === 'function') { cb = h; h = null; }
  w = w || 16; h = h || w;
  self.loading++;
  self.artPacks.getTextureImage(name, function(img) {
    var canvases = [];
    for (var x = 0; x < img.width; x += w) {
      for (var y = 0; y < img.height; y += h) {
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.name = name + '_' + x + '_' + y;
        canvas.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
        canvases.push(canvas);
      }
    }
    var textures = [];
    each(canvases, function(canvas, next) {
      var tex = new Image();
      tex.name = canvas.name;
      tex.src = canvas.toDataURL();
      tex.onload = function() {
        self.pack(tex, next);
      };
      tex.onerror = next;
      textures.push([
        tex.name, tex.name, tex.name,
        tex.name, tex.name, tex.name
      ]);
    }, function() {
      self._afterLoading();
      delete canvases;
      self.materials = self.materials.concat(textures);
      cb(textures);
    });
  }, function(err, img) {
    cb();
  });
  return self;
};

Texture.prototype.animate = function(mesh, names, delay) {
  var self = this;
  delay = delay || 1000;
  if (!Array.isArray(names) || names.length < 2) return false;
  var i = 0;
  var mat = new this.options.materialType(this.options.materialParams);
  mat.map = this.texture;
  mat.transparent = true;
  mat.needsUpdate = true;
  tic.interval(function() {
    self.paint(mesh, names[i % names.length]);
    i++;
  }, delay);
  return mat;
};

Texture.prototype.tick = function(dt) {
  tic.tick(dt);
};

function uvrot(coords, deg) {
  if (deg === 0) return coords;
  var c = [];
  var i = (4 - Math.ceil(deg / 90)) % 4;
  for (var j = 0; j < 4; j++) {
    c.push(coords[i]);
    if (i === 3) i = 0; else i++;
  }
  return c;
}

function uvinvert(coords) {
  var c = coords.slice(0);
  return [c[3], c[2], c[1], c[0]];
}

function each(arr, it, done) {
  var count = 0;
  arr.forEach(function(a) {
    it(a, function() {
      count++;
      if (count >= arr.length) done();
    });
  });
}

////
// Support for textures without atlas ("simple" textures), as in 0.4.0
////

function TextureSimple(game, opts) {
  if (!(this instanceof TextureSimple)) return new TextureSimple(game, opts || {});
  var self = this;
  this.game = game;

  opts = opts || {};
  this.materialType = opts.materialType = opts.materialType || this.THREE.MeshLambertMaterial;
  this.materialParams = opts.materialParams = opts.materialParams || {};
  this._materialDefaults = opts.materialDefaults = opts.materialDefaults ||{ ambient: 0xbbbbbb };
  this.applyTextureParams = opts.applyTextureParams = opts.applyTextureParams || function(map) {
    map.magFilter = self.THREE.NearestFilter;
    map.minFilter = self.THREE.LinearMipMapLinearFilter;
    map.wrapT     = self.THREE.RepeatWrapping;
    map.wrapS     = self.THREE.RepeatWrapping;
  };

  this.THREE              = this.game.THREE || opts.THREE;
  this.materials          = [];
  this.names              = [];
  this.artPacks = opts.artPacks;
  if (!this.artPacks) throw new Error('voxel-texture requires artPacks option');
  this.materialIndex      = [];
  this._animations        = [];

  this.opts = opts;
};

TextureSimple.prototype.reconfigure = function() {
  return reconfigure(this);
};

TextureSimple.prototype.load = function(names, opts) {
  if (!names || names.length === 0) return;
  this.names = this.names.concat(names); // save for reconfiguration

  var self = this;
  opts = self.opts;
  if (!Array.isArray(names)) names = [names];
  if (!hasSubArray(names)) names = [names];
  return [].concat.apply([], names.map(function(name) {
    name = self._expandName(name);
    self.materialIndex.push([self.materials.length, self.materials.length + name.length]);
    return name.map(function(n) {
      if (n instanceof self.THREE.Texture) {
        var map = n;
        n = n.name;
      } else if (typeof n === 'string') {
        var map = self.THREE.ImageUtils.loadTexture(self.artPacks.getTexture(n));
      } else {
        var map = new self.THREE.Texture(n);
        n = map.name;
      }
      self.applyTextureParams.call(self, map);
      var mat = new opts.materialType(opts.materialParams);
      mat.map = map;
      mat.name = n;
      if (opts.transparent == null) self._isTransparent(mat);
      self.materials.push(mat);
      return mat;
    });
  }));
};

TextureSimple.prototype.getMesh = function() {
  return new this.THREE.MeshFaceMaterial(this.get());
};

TextureSimple.prototype.get = function(index) {
  if (index == null) return this.materials;
  if (typeof index === 'number') {
    index = this.materialIndex[index];
  } else {
    index = this.materialIndex[this.findIndex(index) - 1];
  }
  return this.materials.slice(index[0], index[1]);
};

TextureSimple.prototype.find = function(name) {
  for (var i = 0; i < this.materials.length; i++) {
    if (name === this.materials[i].name) return i;
  }
  return -1;
};

TextureSimple.prototype.findIndex = function(name) {
  var index = this.find(name);
  for (var i = 0; i < this.materialIndex.length; i++) {
    var idx = this.materialIndex[i];
    if (index >= idx[0] && index < idx[1]) {
      return i + 1;
    }
  }
  return 0;
};

TextureSimple.prototype._expandName = function(name) {
  if (name.top) return [name.back, name.front, name.top, name.bottom, name.left, name.right];
  if (!Array.isArray(name)) name = [name];
  // load the 0 texture to all
  if (name.length === 1) name = [name[0],name[0],name[0],name[0],name[0],name[0]];
  // 0 is top/bottom, 1 is sides
  if (name.length === 2) name = [name[1],name[1],name[0],name[0],name[1],name[1]];
  // 0 is top, 1 is bottom, 2 is sides
  if (name.length === 3) name = [name[2],name[2],name[0],name[1],name[2],name[2]];
  // 0 is top, 1 is bottom, 2 is front/back, 3 is left/right
  if (name.length === 4) name = [name[2],name[2],name[0],name[1],name[3],name[3]];
  return name;
};

TextureSimple.prototype.paintMesh = function(mesh) {
  this.paint(mesh.geometry);
};

TextureSimple.prototype.paint = function(geom) {
  var self = this;
  geom.faces.forEach(function(face, i) {
    var index = Math.floor(face.color.b*255 + face.color.g*255*255 + face.color.r*255*255*255);
    index = self.materialIndex[Math.floor(Math.max(0, index - 1) % self.materialIndex.length)][0];

    // BACK, FRONT, TOP, BOTTOM, LEFT, RIGHT
    if      (face.normal.z === 1)  index += 1;
    else if (face.normal.y === 1)  index += 2;
    else if (face.normal.y === -1) index += 3;
    else if (face.normal.x === -1) index += 4;
    else if (face.normal.x === 1)  index += 5;

    face.materialIndex = index;
  });
};

TextureSimple.prototype.sprite = function(name, w, h, cb) {
  var self = this;
  if (typeof w === 'function') { cb = w; w = null; }
  if (typeof h === 'function') { cb = h; h = null; }
  w = w || 16; h = h || w;
  self.artPacks.getTextureImage(name, function(img) {
    var textures = [];
    for (var x = 0; x < img.width; x += w) {
      for (var y = 0; y < img.height; y += h) {
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        var tex = new self.THREE.Texture(canvas);
        tex.name = name + '_' + x + '_' + y;
        tex.needsUpdate = true;
        textures.push(tex);
      }
    }
    cb(null, textures);
  }, function(err, img) {
    console.log('TextureSimple sprite '+name+' error '+err+' on '+img);
  });
  return self;
};

TextureSimple.prototype.animate = function(names, delay) {
  var self = this;
  delay = delay || 1000;
  names = names.map(function(name) {
    return (typeof name === 'string') ? self.find(name) : name;
  }).filter(function(name) {
    return (name !== -1);
  });
  if (names.length < 2) return false;
  if (self._clock == null) self._clock = new self.THREE.Clock();
  var mat = self.materials[names[0]].clone();
  self.materials.push(mat);
  names = [self.materials.length - 1, delay, 0].concat(names);
  self._animations.push(names);
  return mat;
};

TextureSimple.prototype.tick = function() {
  var self = this;
  if (self._animations.length < 1 || self._clock == null) return false;
  var t = self._clock.getElapsedTime();
  self._animations.forEach(function(anim) {
    var mats = anim.slice(3);
    var i = Math.round(t / (anim[1] / 1000)) % (mats.length);
    if (anim[2] !== i) {
      self.materials[anim[0]].map = self.materials[mats[i]].map;
      self.materials[anim[0]].needsUpdate = true;
      anim[2] = i;
    }
  });
};

TextureSimple.prototype._isTransparent = function(material) {
  if (!material.map) return;
  if (!material.map.image) return;
  if (material.map.image.nodeName.toLowerCase() === 'img') {
    material.map.image.onload = function() {
      if (isTransparent(this)) {
        material.transparent = true;
        material.needsUpdate = true;
      }
    };
  } else {
    if (isTransparent(material.map.image)) {
      material.transparent = true;
      material.needsUpdate = true;
    }
  }
};

function hasSubArray(ar) {
  var has = false;
  ar.forEach(function(a) { if (Array.isArray(a)) { has = true; return false; } });
  return has;
}

