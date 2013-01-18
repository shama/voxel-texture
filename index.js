/*
 * voxel-texture
 * https://github.com/shama/voxel-texture
 *
 * Copyright (c) 2013 Kyle Robinson Young
 * Licensed under the MIT license.
 */

module.exports = function(game) {
  // BACK, FRONT, TOP, BOTTOM, LEFT, RIGHT
  return function(data) {
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
    return new game.THREE.MeshFaceMaterial(data.map(function(name) {
      var tex       = game.THREE.ImageUtils.loadTexture(game.texturePath + ext(name));
      tex.magFilter = game.THREE.NearestFilter;
      tex.minFilter = game.THREE.LinearMipMapLinearFilter;
      tex.wrapT     = game.THREE.RepeatWrapping;
      tex.wrapS     = game.THREE.RepeatWrapping;
      return new game.THREE.MeshLambertMaterial({
        map: tex,
        ambient: 0xbbbbbb
      });
    }));
  };
};

function ext(name) {
  return (name.indexOf('.') !== -1) ? name : name + '.png';
}

// copied from https://github.com/joyent/node/blob/master/lib/util.js#L433
function isArray(ar) {
  return Array.isArray(ar) || (typeof ar === 'object' && Object.prototype.toString.call(ar) === '[object Array]');
}
