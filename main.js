// important note:
// the pivot of a blob part is its upper-left corner, _not_ its center

// max distance from centers
const maxDist = {x: 80, y: 150}

// how bunched up circles are to
// the image center at start
const closenessToCenter = {x: 1.5, y: 1}
const n_circles = 5
const padding = 10
const shadowOffset = {x: 6, y: 6}
const radiusRange = [60,100]
const velDamp = {x: 40, y: 40}
const gooeyness = 20;
const bounceStrength = 0.5
const onHover = 'reveal' // 'reveal' or 'follow'

// get a random number in [-r, r]
function randRange(r) {
    return (Math.random() * r * 2) - r
}

function clamp(v, mn, mx) {
  return Math.max(Math.min(v, mx), mn)
}

class BlobImage {
  constructor(el) {
    this.el = el
    this.height = this.el.clientHeight
    this.width = this.el.clientWidth
    this.svg = SVG(el).size(this.width, this.height)
    this.imageEl = this.el.getElementsByTagName('img')[0]
    this.imageSrc = this.imageEl.src
    this.image = this.svg.image(this.imageSrc, this.width, this.height)
    this.group = this.svg.group()
    this.shadow = this.svg.group()
    this.center = {x: this.width/2, y: this.height/2}

    this.blobParts = []
    for (var i=0; i<n_circles; i++) {
      var blobPart = this.makeBlobPart()
      this.blobParts.push(blobPart)
      this.group.add(blobPart.circle)
      this.shadow.add(blobPart.shadow)
    }

    // blobbing filter
    this.group.filter(function(add) {
      var blur = add.gaussianBlur(gooeyness)
      var goo = blur.colorMatrix('matrix',
          [ 1.0, 0,   0,   0,   0
          , 0,   1.0, 0,   0,   0
          , 0,   0,   1.0, 0,   0
          , 0,   0,   0,   18, -7 ])
      add.blend(add.source, goo)
    })
    this.shadow.back()
    this.image.maskWith(this.group)

    var self = this
    this.hovered = false
    if (onHover === 'reveal') {
      this.el.addEventListener('mouseenter', function() {
        var r = Math.max(self.height, self.width)/2
        self.hovered = true
        self.blobParts.map(function(bp) {
          bp.circle.stop(false, true)
          bp.circle.animate(200).radius(r).during(function() {
            self.image.maskWith(self.group)
          }).after(function() {
            self.imageEl.style.visibility = 'visible'
          });
        })
      })
      this.el.addEventListener('mouseleave', function() {
        self.imageEl.style.visibility = 'hidden'
        self.blobParts.map(function(bp) {
          bp.circle.stop(false, true)
          bp.circle.animate(400).radius(bp.rad).during(function() {
            self.image.maskWith(self.group)
          }).after(function() {
            self.hovered = false
          });
        })
      })
    } else if (onHover === 'follow') {
      this.el.addEventListener('mousemove', function(ev) {
        self.blobParts.map(function(bp) {
          bp.center = {
            x: ev.offsetX,
            y: ev.offsetY
          }
        })
      })
      this.el.addEventListener('mouseleave', function() {
        self.blobParts.map(function(bp) {
          bp.center = bp._center
        })
      })
    }
  }

  // check if this is in the current viewport, any part of it
  // just checking vertical
  get isVisible() {
    var rect = this.el.getBoundingClientRect()
    var height = window.innerHeight || document.documentElement.clientHeight
    return (
        (rect.top >= 0 && rect.top <= height) || (rect.bottom >=0 && rect.bottom <= height)
    )
  }

  clampPos(pos, rad) {
    // multiplying by 2.2 instead of 2 for some padding
    pos.x = clamp(pos.x, 0, this.width-rad*2.2)
    pos.y = clamp(pos.y, 0, this.height-rad*2.2)
  }

  makeBlobPart() {
    var radius = radiusRange[0] + (Math.random() * (radiusRange[1] - radiusRange[0]))
    var centerMaxDist = {
      x: this.width/2 - radius*2 - padding,
      y: this.height/2 - radius*2 - padding
    }
    var pos = {
      x: this.center.x + randRange(maxDist.x)/closenessToCenter.x - radius/2,
      y: this.center.y + randRange(maxDist.y)/closenessToCenter.y - radius/2
    }
    var center = {
        x: this.center.x + randRange(centerMaxDist.x),
        y: this.center.y + randRange(centerMaxDist.y)
    }

    this.clampPos(pos, radius)

    return {
      rad: radius,
      vel: {x: 0, y: 0},
      pos: pos,
      center: center,
      _center: center,
      circle: this.svg.circle(radius*2)
        .move(pos.x, pos.y)
        .fill({ color: '#fff' }),
      shadow: this.svg.circle(radius*2)
        .move(pos.x + shadowOffset.x, pos.y + shadowOffset.y)
        .fill({ color: '#DD7575' })
    }
  }

  // compute force on velocity,
  // based on distance from a blob part's center
  centerForce(blobPart) {
      var d = {
          x: blobPart.pos.x + blobPart.rad/2 - blobPart.center.x,
          y: blobPart.pos.y + blobPart.rad/2 - blobPart.center.y
      }
      return {
          x: -(d.x/maxDist.x)/velDamp.x,
          y: -(d.y/maxDist.y)/velDamp.y,
      }
  }

  debug() {
    // draw blob center
    var r = 10
    this.svg.circle(r)
      .move(
        this.center.x - r/2,
        this.center.y - r/2)
      .fill({color: '#ff0000'})
  }

  update() {
    if (this.hovered) {
      return
    }
    var self = this
    this.blobParts.map(function(bp) {
      var force = self.centerForce(bp)
      bp.vel.x += force.x
      bp.vel.y += force.y

      // bounding w a lil bounce
      if (bp.pos.x + bp.rad * 2 >= self.width - padding || bp.pos.x <= padding) {
        bp.vel.x *= -bounceStrength
      }
      if (bp.pos.y + bp.rad * 2 >= self.height - padding || bp.pos.y <= padding) {
        bp.vel.y *= -bounceStrength
      }

      bp.pos.x += bp.vel.x
      bp.pos.y += bp.vel.y

      self.clampPos(bp.pos, bp.rad)
      bp.circle.move(bp.pos.x, bp.pos.y)
      bp.shadow.move(
        bp.pos.x + shadowOffset.x,
        bp.pos.y + shadowOffset.y)
    })
    // need to re-apply the mask after movement
    this.image.maskWith(this.group)
  }
}

// create blob images
const figures = [...document.querySelectorAll('.project figure')]
const blobs = []
figures.map(function(el) {
  var img = el.querySelector('img');
  if (img.complete) {
    blobs.push(new BlobImage(el))
  } else {
    img.addEventListener('load', function() {
      blobs.push(new BlobImage(el))
    })
  }
})


// use setInterval to specify FPS
const FPS = 24;
setInterval(function() {
  blobs.map(function(blob) {
    // only update visible blobs
    if (blob.isVisible) {
      blob.update()
    }
  })
}, Math.floor(1000/24));

