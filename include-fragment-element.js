/* eslint-disable github/no-then */

;(function() {
  'use strict'

  const privateData = new WeakMap()

  function fire(name, target) {
    setTimeout(function() {
      const event = target.ownerDocument.createEvent('Event')
      event.initEvent(name, false, false)
      target.dispatchEvent(event)
    }, 0)
  }

  function handleData(el, data) {
    return data.then(
      function(html) {
        const parentNode = el.parentNode
        if (parentNode) {
          el.insertAdjacentHTML('afterend', html)
          parentNode.removeChild(el)
        }
      },
      function() {
        el.classList.add('is-error')
      }
    )
  }

  const IncludeFragmentPrototype = Object.create(window.HTMLElement.prototype)

  Object.defineProperty(IncludeFragmentPrototype, 'src', {
    get() {
      const src = this.getAttribute('src')
      if (src) {
        const link = this.ownerDocument.createElement('a')
        link.href = src
        return link.href
      } else {
        return ''
      }
    },

    set(value) {
      this.setAttribute('src', value)
    }
  })

  function getData(el) {
    const src = el.src
    let data = privateData.get(el)
    if (data && data.src === src) {
      return data.data
    } else {
      if (src) {
        data = el.load()
      } else {
        data = Promise.reject(new Error('missing src'))
      }
      privateData.set(el, {src, data})
      return data
    }
  }

  Object.defineProperty(IncludeFragmentPrototype, 'data', {
    get() {
      return getData(this)
    }
  })

  IncludeFragmentPrototype.attributeChangedCallback = function(attrName) {
    if (attrName === 'src') {
      // Reload data load cache.
      const data = getData(this)

      // Source changed after attached so replace element.
      if (this._attached) {
        handleData(this, data)
      }
    }
  }

  IncludeFragmentPrototype.createdCallback = function() {
    // Preload data cache
    getData(this)['catch'](function() {
      // Ignore `src missing` error on pre-load.
    })
  }

  IncludeFragmentPrototype.attachedCallback = function() {
    this._attached = true
    if (this.src) {
      handleData(this, getData(this))
    }
  }

  IncludeFragmentPrototype.detachedCallback = function() {
    this._attached = false
  }

  IncludeFragmentPrototype.request = function() {
    const src = this.src
    if (!src) {
      throw new Error('missing src')
    }

    return new Request(src, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'text/html'
      }
    })
  }

  IncludeFragmentPrototype.load = function() {
    const self = this

    return Promise.resolve()
      .then(function() {
        const request = self.request()
        fire('loadstart', self)
        return self.fetch(request)
      })
      .then(function(response) {
        if (response.status !== 200) {
          throw new Error(`Failed to load resource: the server responded with a status of ${response.status}`)
        }

        const ct = response.headers.get('Content-Type')
        if (!ct || !ct.match(/^text\/html/)) {
          throw new Error(`Failed to load resource: expected text/html but was ${ct}`)
        }

        return response
      })
      .then(function(response) {
        return response.text()
      })
      .then(
        function(data) {
          fire('load', self)
          fire('loadend', self)
          return data
        },
        function(error) {
          fire('error', self)
          fire('loadend', self)
          throw error
        }
      )
  }

  IncludeFragmentPrototype.fetch = function(request) {
    return fetch(request)
  }

  window.IncludeFragmentElement = document.registerElement('include-fragment', {
    prototype: IncludeFragmentPrototype
  })
})()
