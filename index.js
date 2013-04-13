var transparent = require('opaque').transparent;
var tic = require('tic')();
var createAtlas = require('atlaspack');

function Texture(opts) {
  if (!(this instanceof Texture)) return new Texture(opts || {});
  this.game = opts.game;
  this.THREE = this.game.THREE;
  this.materials = Object.create(null);
  this.texturePath = opts.texturePath || '/textures/';

  this.options = defaults(opts || {}, {
    crossOrigin: 'Anonymous',
    materialParams: defaults(opts.materialParams || {}, {
      ambient: 0xbbbbbb
    }),
    materialType: this.THREE.MeshLambertMaterial,
    applyTextureParams: function(map) {
      map.magFilter = this.THREE.NearestFilter;
      map.minFilter = this.THREE.LinearMipMapLinearFilter;
      //map.wrapT = map.wrapS = self.THREE.RepeatWrapping;
    }.bind(this)
  });

  this._animations = [];

  // create a canvas for the texture atlas
  this._canvas = document.createElement('canvas');
  this._canvas.width = opts.atlasWidth || 1024;
  this._canvas.height = opts.atlasHeight || 1024;

  // create core atlas and texture
  this._atlas = createAtlas(this._canvas);
  this._atlasuv = false;
  this._texture = new this.THREE.Texture(this._canvas);
  this.options.applyTextureParams.call(self, this._texture);

  // create core material for easy application to meshes
  this.material = new this.options.materialType(this.options.materialParams);
  this.material.map = this._texture;
  this.material.transparent = true;
}
module.exports = Texture;

Texture.prototype.load = function(names, opts) {
  var self = this;
  opts = defaults(opts || {}, this.options);
  if (!isArray(names)) names = [names];

  // create materials
  var created = Object.create(null);
  function createMaterial(name, type) {
    if (created[name]) return created[name];
    var mat = new opts.materialType(opts.materialParams);
    mat.map = self._texture;
    mat.name = name;
    mat.transparent = true;
    return created[name] = mat;
  }

  // expand and create materials object
  var type = Object.keys(self.materials).length;
  var materialSlice = Object.create(null);
  names.map(self._expandName).forEach(function(group) {
    var materials = [];
    group.forEach(function(name) {
      materials.push(createMaterial(name, type));
    });
    materialSlice[type] = self.materials[type] = materials;
    type++;
  });

  // load onto the texture atlas
  self._atlasuv = false;
  var load = Object.create(null);
  Object.keys(materialSlice).forEach(function(k) {
    materialSlice[k].forEach(function(mat) {
      load[mat.name] = true;
    });
  });
  each(Object.keys(load), self.pack.bind(self), function() {
    self._atlasuv = self._atlas.uv();
    self._texture.needsUpdate = true;
    self.material.needsUpdate = true;
    //window.open(self._canvas.toDataURL());
    Object.keys(self.game.voxels.meshes).forEach(function(pos) {
      self.game.voxels.meshes[pos].geometry = self.paint(self.game.voxels.meshes[pos].geometry);
    });
  });

  return materialSlice;
};

Texture.prototype.pack = function(name, done) {
  var self = this;
  function pack(img) {
    var node = self._atlas.pack(img);
    if (node === false) {
      self._atlas = self._atlas.expand(img);
    }
    done();
  }
  if (typeof name === 'string') {
    var img = new Image();
    img.src = self.texturePath + ext(name);
    img.id = name;
    img.crossOrigin = self.options.crossOrigin;
    img.onload = function() {
      pack(img);
    };
    img.onerror = function() {
      console.error('Couldn\'t load URL [' + img.src + ']');
    };
  }
  return self;
};

Texture.prototype.get = function(type) {
  var self = this;
  if (type) return self.materials[type];
  return [].concat.apply([], Object.keys(self.materials).map(function(k) {
    return self.materials[k];
  }));
};

/*
Texture.prototype.find = function(name) {
  for (var i = 0; i < this.materials.length; i++) {
    if (name === this.materials[i].name) return i;
  }
  return -1;
};
*/

Texture.prototype.findIndex = function(name) {
  var self = this;
  var type = 0;
  Object.keys(self.materials).forEach(function(i) {
    self.materials[i].forEach(function(mat) {
      if (mat.name === name) {
        type = i;
        return false;
      }
    });
    if (type !== 0) return false;
  });
  return type;
};

Texture.prototype._expandName = function(name) {
  if (name.top) return [name.back, name.front, name.top, name.bottom, name.left, name.right];
  if (!isArray(name)) name = [name];
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

Texture.prototype.paint = function(geom) {
  var self = this;
  if (self._atlasuv === false) return;

  geom.faces.forEach(function(face, i) {
    if (geom.faceVertexUvs[0].length < 1) return;

    var index = Math.floor(face.color.b*255 + face.color.g*255*255 + face.color.r*255*255*255);
    var materials = self.materials[index - 1];
    if (!materials) materials = self.materials[0];

    // BACK, FRONT, TOP, BOTTOM, LEFT, RIGHT
    var name = materials[0].name;
    if      (face.normal.z === 1)  name = materials[1].name;
    else if (face.normal.y === 1)  name = materials[2].name;
    else if (face.normal.y === -1) name = materials[3].name;
    else if (face.normal.x === -1) name = materials[4].name;
    else if (face.normal.x === 1)  name = materials[5].name;

    var atlasuv = self._atlasuv[name];
    if (!atlasuv) return;

    // 0 -- 1
    // |    |
    // 3 -- 2
    // faces on these meshes are flipped vertically, so we map in reverse
    if (face.normal.z === -1 || face.normal.x === 1) {
      geom.faceVertexUvs[0][i][0].x =     atlasuv[2][0];
      geom.faceVertexUvs[0][i][0].y = 1 - atlasuv[2][1];
      geom.faceVertexUvs[0][i][1].x =     atlasuv[1][0];
      geom.faceVertexUvs[0][i][1].y = 1 - atlasuv[1][1];
      geom.faceVertexUvs[0][i][2].x =     atlasuv[0][0];
      geom.faceVertexUvs[0][i][2].y = 1 - atlasuv[0][1];
      geom.faceVertexUvs[0][i][3].x =     atlasuv[3][0];
      geom.faceVertexUvs[0][i][3].y = 1 - atlasuv[3][1];
    } else {
      geom.faceVertexUvs[0][i][0].x =     atlasuv[3][0];
      geom.faceVertexUvs[0][i][0].y = 1 - atlasuv[3][1];
      geom.faceVertexUvs[0][i][1].x =     atlasuv[2][0];
      geom.faceVertexUvs[0][i][1].y = 1 - atlasuv[2][1];
      geom.faceVertexUvs[0][i][2].x =     atlasuv[1][0];
      geom.faceVertexUvs[0][i][2].y = 1 - atlasuv[1][1];
      geom.faceVertexUvs[0][i][3].x =     atlasuv[0][0];
      geom.faceVertexUvs[0][i][3].y = 1 - atlasuv[0][1];
    }
  });

  geom.uvsNeedUpdate = true;
  return geom;
};

// TODO: fix this to load onto the atlas
Texture.prototype.sprite = function(name, w, h, cb) {
  var self = this;
  if (typeof w === 'function') { cb = w; w = null; }
  if (typeof h === 'function') { cb = h; h = null; }
  w = w || 16; h = h || w;
  var img = new Image();
  img.src = self.texturePath + ext(name);
  img.onerror = cb;
  img.onload = function() {
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
  };
  return self;
};

// TODO: instead of names just pass materials to animate
Texture.prototype.animate = function(names, delay) {
  var self = this;
  delay = delay || 1000;
  names = names.map(function(name) {
    return (typeof name === 'string') ? self.find(name) : name;
  }).filter(function(name) {
    return (name !== -1);
  });
  if (names.length < 2) return false;

  var i = 0;
  var mat = self.materials[names[0]].clone();
  tic.interval(function() {
    mat.map = self.materials[names[i % names.length]].map;
    mat.needsUpdate = true;
    i++;
  }, delay);

  self.materials.push(mat);
  return mat;
};

Texture.prototype.tick = function(dt) {
  tic.tick(dt);
};

// TODO: Deprecate this
Texture.prototype._isTransparent = function(material) {
  if (!material.map) return;
  if (!material.map.image) return;
  if (material.map.image.nodeName.toLowerCase() === 'img') {
    material.map.image.onload = function() {
      if (transparent(this)) {
        material.transparent = true;
        material.needsUpdate = true;
      }
    };
  } else {
    if (transparent(material.map.image)) {
      material.transparent = true;
      material.needsUpdate = true;
    }
  }
};

function ext(name) {
  return (String(name).indexOf('.') !== -1) ? name : name + '.png';
}

// copied from https://github.com/joyent/node/blob/master/lib/util.js#L433
function isArray(ar) {
  return Array.isArray(ar) || (typeof ar === 'object' && Object.prototype.toString.call(ar) === '[object Array]');
}

function defaults(obj) {
  [].slice.call(arguments, 1).forEach(function(from) {
    if (from) for (var k in from) if (obj[k] == null) obj[k] = from[k];
  });
  return obj;
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
