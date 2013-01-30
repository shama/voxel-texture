function Texture(names, opts) {
  if (!(this instanceof Texture)) return new Texture(names, opts || {});
  if (!isArray(name)) {
    opts = names;
    names = null;
  }
  this.THREE          = opts.THREE          || require('three');
  this.materials      = [];
  this.texturePath    = opts.texturePath    || '/textures/';
  this.materialParams = opts.materialParams || {};
  this.materialType   = opts.materialType   || this.THREE.MeshLambertMaterial;
  this._materialDefaults = {
    ambient: 0xbbbbbb,
    transparent: true
  };
  this._textureDefaults = {
    magFilter: this.THREE.NearestFilter,
    minFilter: this.THREE.LinearMipMapLinearFilter,
    wrapT:     this.THREE.RepeatWrapping,
    wrapS:     this.THREE.RepeatWrapping
  };
  if (names) this.loadTexture(names);
}
module.exports = Texture;

Texture.prototype.load = function(names, opts) {
  var self = this;
  opts = opts || {};
  opts.materialType   = opts.materialType || this.materialType;
  opts.materialParams = opts.materialParams || this.materialParams;
  return this._expandNames(names).map(function(name, i) {
    if (name instanceof self.THREE.Texture) {
      var map = name;
      name = name.name;
    } else if (typeof name === 'string') {
      var map = self.THREE.ImageUtils.loadTexture(self.texturePath + ext(name));
    } else {
      var map = new self.THREE.Texture(name);
      name = map.name;
    }
    var mat = new opts.materialType(defaults(opts.materialParams, self._materialDefaults));
    mat.map = map;
    mat.name = name;
    // rotate front and left 90 degs
    //if (self._loadingMesh === true && (i === 1 || i === 4)) self.rotate(mat, 90);
    self.materials.push(mat);
    return mat;
  });
  //return (self._loadingMesh !== true) ? new self.THREE.MeshFaceMaterial(data) : data;
};

Texture.prototype.get = function(names, sides) {
  var self = this;
  sides = sides || self.materials.length;
  if (names == null) return new self.THREE.MeshFaceMaterial(self.materials);
  if (!isArray(names)) names = [names];
  names = [].concat.apply([], names.map(function(name) {
    if (typeof name === 'string') {
      for (var i = 0; i < self.materials.length; i++) {
        if (name === self.materials[i].name) { name = i; break; }
      }
    }
    name = Number(name);
    var end = ((name + sides) < self.materials.length) ? name + sides : self.materials.length;
    return self.materials.slice(name, end);
  }));
  return new self.THREE.MeshFaceMaterial(names);
};

Texture.prototype._expandNames = function(names) {
  if (!isArray(names)) names = [names];
  return [].concat.apply([], names.map(function(name) {
    if (name.top) return [name.back, name.front, name.top, name.bottom, name.left, name.right];
    if (!isArray(name)) return name;
    // load the 0 texture to all
    if (name.length === 1) name = [name[0],name[0],name[0],name[0],name[0],name[0]];
    // 0 is top/bottom, 1 is sides
    if (name.length === 2) name = [name[1],name[1],name[0],name[0],name[1],name[1]];
    // 0 is top, 1 is bottom, 2 is sides
    if (name.length === 3) name = [name[2],name[2],name[0],name[1],name[2],name[2]];
    // 0 is top, 1 is bottom, 2 is front/back, 3 is left/right
    if (name.length === 4) name = [name[2],name[2],name[0],name[1],name[3],name[3]];
    return name;
  }));
};

/* deprecated
Texture.prototype.loadTextures = function(names, opts) {
  var self = this;
  self._loadingMesh = true;
  self.material = new self.THREE.MeshFaceMaterial(
    [].concat.apply([], names.map(function(name) {
      return self.material(name, opts);
    }))
  );
  self._loadingMesh = false;
  return self.material;
};
*/

/* todo: merge with paint
Texture.prototype.applyTextures = function(geom) {
  var self = this;
  if (!self.material) return;
  var textures = self.material.materials;
  geom.faces.forEach(function(face) {
    var c = face.vertexColors[0];
    var index = Math.floor(c.b*255 + c.g*255*255 + c.r*255*255*255);
    index = (Math.max(0, index - 1) % (textures.length / 6)) * 6;

    // BACK, FRONT, TOP, BOTTOM, LEFT, RIGHT
    if      (face.normal.z === 1)  index += 1;
    else if (face.normal.y === 1)  index += 2;
    else if (face.normal.y === -1) index += 3;
    else if (face.normal.x === -1) index += 4;
    else if (face.normal.x === 1)  index += 5;

    face.materialIndex = index;
  });
};
*/

Texture.prototype.paint = function(where, materials) {
};

// chop up a sprite map into textures
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

// generate an animated material
Texture.prototype.animate = function(textures) {
};

Texture.prototype.rotate = function(material, deg) {
  var self = this;
  deg = deg || 90;
  if (material.map && material.map.image) material.map.image.onload = function() {
    var canvas    = document.createElement('canvas');
    canvas.width  = this.width;
    canvas.height = this.height;
    var ctx       = canvas.getContext('2d');

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 180 * deg);
    ctx.drawImage(this, -(canvas.width / 2), -(canvas.height / 2));

    material.map = new self.THREE.Texture(canvas);
    self._applyTextureSettings(material.map);

    if (material.uniforms && material.uniforms.map) {
      material.uniforms.map.value = material.map;
    }

    material.needsUpdate = true;
  };
};

Texture.prototype._applyTextureSettings = function(tex) {
  tex.magFilter = this.THREE.NearestFilter;
  tex.minFilter = this.THREE.LinearMipMapLinearFilter;
  tex.wrapT     = this.THREE.RepeatWrapping;
  tex.wrapS     = this.THREE.RepeatWrapping;
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
