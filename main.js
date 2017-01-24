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
const radiusRange = [0.4,0.9]
const velDamp = {x: 40, y: 40}
const gooeyness = 20
const bounceStrength = 0.5
const onHover = 'reveal' // 'reveal' or 'follow'

// get a random number in [-r, r]
function randRange(r) {
    return (Math.random() * r * 2) - r
}

// keep a value within a range [mn, mx]
function clamp(v, mn, mx) {
  return Math.max(Math.min(v, mx), mn)
}

class BlobImage {
  constructor(el) {
    // compute some dimension stuff from the element
    this.el = el
    this.height = this.el.clientHeight
    this.width = this.el.clientWidth
    this.center = {x: this.width/2, y: this.height/2}

    // setup the SVG
    this.svg = SVG(el).size(this.width, this.height)

    // create an SVG element of the image
    this.imageEl = this.el.querySelector('img')
    this.imageSrc = this.imageEl.src
    this.image = this.svg.image(this.imageSrc, this.width, this.height)

    // the masking blob parts go here
    this.group = this.svg.group()

    // the shadow blob parts go here
    this.shadow = this.svg.group()

    // create the blob parts
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
      // on enter, expand blob parts to cover the entire image
      // as a fallback, set the original html img to visible
      this.el.addEventListener('mouseenter', function() {
        var r = Math.max(self.height, self.width)/2
        self.hovered = true
        self.blobParts.map(function(bp) {
          bp.circle.stop(false, true)
          bp.circle.animate(200).radius(r).during(function() {
            self.image.maskWith(self.group)
          }).after(function() {
            self.imageEl.style.visibility = 'visible'
          })
        })
      })

      // on leave, shrink the blob parts back to their original size
      // and hide the html img again
      this.el.addEventListener('mouseleave', function() {
        self.imageEl.style.visibility = 'hidden'
        self.blobParts.map(function(bp) {
          bp.circle.stop(false, true)
          bp.circle.animate(400).radius(bp.rad).during(function() {
            self.image.maskWith(self.group)
          }).after(function() {
            self.hovered = false
          })
        })
      })
    } else if (onHover === 'follow') {
      // set the blob parts' centers to the mouse position
      this.el.addEventListener('mousemove', function(ev) {
        self.blobParts.map(function(bp) {
          bp.center = {
            x: ev.offsetX,
            y: ev.offsetY
          }
        })
      })

      // reset the blob parts' centers
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
    // keep blob parts within the image.
    // multiplying by 2.2 instead of 2 for some padding
    pos.x = clamp(pos.x, padding, this.width-rad*2.2)
    pos.y = clamp(pos.y, padding, this.height-rad*2.2)
  }

  makeBlobPart() {
    var radiusMult = radiusRange[0] + (Math.random() * (radiusRange[1] - radiusRange[0]))
    var radius = radiusMult * Math.min(this.width, this.height)/2
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

    // so no blob parts start partially off the image
    this.clampPos(pos, radius)

    return {
      rad: radius,
      vel: {x: 0, y: 0},
      pos: pos,
      center: center,
      _center: center, // so we remember the original center
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

  // compute force on each blob,
  // and apply velocity
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

  resize() {
    var scale = this.imageEl.width/this.width
    this.width = this.imageEl.width
    this.height = this.imageEl.height
    this.center = {x: this.width/2, y: this.height/2}
    this.svg.size(this.width, this.height)
    this.image.size(this.width, this.height)
    this.blobParts.map(bp => {
      bp.rad *= scale
      bp.circle.radius(bp.rad)
      bp.shadow.radius(bp.rad)
      bp.center = this.center
      bp._center = this.center
      this.clampPos(bp.pos, bp.rad)
    })
  }
}

// create blob images
const figures = [...document.querySelectorAll('.project figure')]
const blobs = []
const imgDims = []
figures.map(function(el) {
  // wait for image to load if necessary
  var img = el.querySelector('img')
  if (img.complete) {
    blobs.push(new BlobImage(el))
  } else {
    img.addEventListener('load', function() {
      blobs.push(new BlobImage(el))
    })
  }
})

window.addEventListener('resize', function() {
  blobs.map(blob => blob.resize())
})

// use setInterval to specify FPS
const FPS = 24
setInterval(function() {
  blobs.map(function(blob) {
    // only update visible blobs
    if (blob.isVisible) {
      blob.update()
    }
  })
}, Math.floor(1000/24))

