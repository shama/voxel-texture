function Texture(names, opts) {
  if (!(this instanceof Texture)) return new Texture(names, opts);
  opts = opts || {};
  if (!isArray(name)) {
    opts = names;
    names = null;
  }
  this.THREE = opts.THREE || require('three');
  this.texturePath = opts.texturePath || '/textures/';
  if (names) this.loadTextures(names);
}
module.exports = Texture;

Texture.prototype.loadTexture = function(data) {
  var self = this;
  if (typeof data === 'string') data = [data];
  if (!isArray(data)) {
    data = [data.back, data.front, data.top, data.bottom, data.left, data.right];
  }
  // load the 0 texture to all
  if (data.length === 1) data = [data[0],data[0],data[0],data[0],data[0],data[0]];
  // 0 is top/bottom, 1 is sides
  if (data.length === 2) data = [data[1],data[1],data[0],data[0],data[1],data[1]];
  // 0 is top, 1 is bottom, 2 is sides
  if (data.length === 3) data = [data[2],data[2],data[0],data[1],data[2],data[2]];
  // 0 is top, 1 is bottom, 2 is front/back, 3 is left/right
  if (data.length === 4) data = [data[2],data[2],data[0],data[1],data[3],data[3]];
  data = data.map(function(name, i) {
    var tex       = self.THREE.ImageUtils.loadTexture(self.texturePath + ext(name));
    tex.magFilter = self.THREE.NearestFilter;
    tex.minFilter = self.THREE.LinearMipMapLinearFilter;
    tex.wrapT     = self.THREE.RepeatWrapping;
    tex.wrapS     = self.THREE.RepeatWrapping;
    return new self.THREE.MeshLambertMaterial({
      map: tex,
      ambient: 0xbbbbbb
    });
  });
  return (self._loadingMulti !== true) ? new self.THREE.MeshFaceMaterial(data) : data;
};

Texture.prototype.loadTextures = function(names) {
  var self = this;
  self._loadingMulti = true;
  self.material = new self.THREE.MeshFaceMaterial(
    [].concat.apply([], names.map(function(name) {
      return self.loadTexture(name);
    }))
  );
  self._loadingMulti = false;
  return self.material;
};

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

    // todo: figure out why left and back need a -90 rotation

    face.materialIndex = index;
  })
};

function ext(name) {
  return (name.indexOf('.') !== -1) ? name : name + '.png';
}

// copied from https://github.com/joyent/node/blob/master/lib/util.js#L433
function isArray(ar) {
  return Array.isArray(ar) || (typeof ar === 'object' && Object.prototype.toString.call(ar) === '[object Array]');
}
