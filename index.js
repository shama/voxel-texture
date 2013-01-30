function Texture(names, opts) {
  var self = this;
  if (!(this instanceof Texture)) return new Texture(names, opts || {});
  if (!isArray(name)) {
    opts = names;
    names = null;
  }
  this.THREE              = opts.THREE          || require('three');
  this.materials          = [];
  this.texturePath        = opts.texturePath    || '/textures/';
  this.materialParams     = opts.materialParams || {};
  this.materialType       = opts.materialType   || this.THREE.MeshLambertMaterial;
  this.materialIndex      = [];
  this._materialDefaults  = { ambient: 0xbbbbbb, transparent: true };
  this.applyTextureParams = opts.applyTextureParams || function(map) {
    map.magFilter = self.THREE.NearestFilter;
    map.minFilter = self.THREE.LinearMipMapLinearFilter;
    map.wrapT     = self.THREE.RepeatWrapping;
    map.wrapS     = self.THREE.RepeatWrapping;
  }
  if (names) this.loadTexture(names);
}
module.exports = Texture;

Texture.prototype.load = function(names, opts) {
  var self = this;
  opts = self._options(opts);
  if (!isArray(names)) names = [names];
  return [].concat.apply([], names.map(function(name) {
    name = self._expandName(name);
    self.materialIndex.push([self.materials.length, self.materials.length + name.length]);
    return name.map(function(n) {
      if (n instanceof self.THREE.Texture) {
        var map = n;
        n = n.name;
      } else if (typeof n === 'string') {
        var map = self.THREE.ImageUtils.loadTexture(self.texturePath + ext(n));
      } else {
        var map = new self.THREE.Texture(n);
        n = map.name;
      }
      self.applyTextureParams(map);

      var mat = new opts.materialType(opts.materialParams);
      mat.map = map;
      mat.name = n;

      // rotate front and left 90 degs
      //if (self._loadingMesh === true && (i === 1 || i === 4)) self.rotate(mat, 90);
      self.materials.push(mat);
      return mat;
    });
  }));
  //return (self._loadingMesh !== true) ? new self.THREE.MeshFaceMaterial(data) : data;
};

Texture.prototype.get = function(index) {
  if (typeof index === 'number') {
    index = this.materialIndex[index];
  } else {
    for (var i = 0; i < this.materials.length; i++) {
      if (index === this.materials[i].name) {
        index = i;
        break;
      }
    }
    for (var i = 0; i < this.materialIndex.length; i++) {
      var idx = this.materialIndex[i];
      if (index >= idx[0] && index < idx[1]) {
        index = idx;
        break;
      }
    }
  }
  return this.materials.slice(index[0], index[1]);
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

Texture.prototype._options = function(opts) {
  opts = opts || {};
  opts.materialType = opts.materialType || this.materialType;
  opts.materialParams = defaults(opts.materialParams || {}, this._materialDefaults, this.materialParams);
  opts.applyTextureParams = opts.applyTextureParams || this.applyTextureParams;
  return opts;
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
