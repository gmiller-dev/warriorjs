
const Status = {
  Success: 'Success',
  Failure: 'Failure',
  Running: 'Running'
}
/**
 * Enumerator
 */

class Enumerator {
  constructor (nodes) {
    this.nodes = nodes
    this.currentIndex = 0
  }

  [Symbol.iterator] () {
    const self = this
    return {
      next () {
        if (self.hasNext()) {
          const value = self.current()
          self.next()
          return {value, done: false}
        } else {
          return {done: true}
        }
      }
    }
  }

  isStarted () {
    return this.current !== undefined
  }

  current () {
    return this.nodes[this.currentIndex]
  }

  hasNext () {
    return this.currentIndex < this.nodes.length - 1
  }

  reset () {
    this.currentIndex = 0
  }

  next () {
    if (this.hasNext()) {
      this.currentIndex++
      return true
    } else {
      return false
    }
  }
}

/**
 * Behavior Tree Nodes
 */

 /**
  * Action
  */
class Action {
  constructor (name, action) {
    this.name = name
    this.action = action
  }

  tick (state) {
    const result = this.action(state)
    return result
  }
}

/**
 * Sequence
 */
class Sequence {
  constructor (name, keepState = false) {
    this.name = name
    this.keepState = keepState
    this.children = []
  }

  init () {
    this.enumerator = new Enumerator(this.children)
  }

  tick (state) {
    if (!this.enumerator || !this.keepState) {
      this.init()
    }

    if (!this.enumerator.isStarted()) {
      return Status.Running
    }
    let status = ''
    do {
      status = this.enumerator.current().tick(state)
      if (status !== Status.Success) {
        if (status === Status.Failure) {
          this.enumerator.reset()
        }
        return status
      }
    } while (this.enumerator.next())
    this.enumerator.reset()
    return status
  }

  addChild (child) {
    this.children.push(child)
    return this
  }
}

/**
 * Selector
 */
class Selector {
  constructor (name, keepState = false) {
    this.name = name
    this.keepState = keepState
    this.children = []
  }

  init () {
    this.enumerator = new Enumerator(this.children)
  }

  tick (state) {
    if (!this.enumerator || !this.keepState) {
      this.init()
    }

    if (!this.enumerator.isStarted()) {
      return Status.Running
    }

    do {
      const status = this.enumerator.current().tick(state)
      switch (status) {
        case Status.Running:
          return status
        case Status.Success:
          this.enumerator.reset()
          return status
        case Status.Failure:
          break
      }
    } while (this.enumerator.next())
    this.enumerator.reset()
  }

  addChild (child) {
    this.children.push(child)
    return this
  }
}

class Decorator {
  constructor (name, {before = (x) => x, after = (x) => x}) {
    this.name = name
    this.before = before
    this.after = after
    this.should_skip = false
  }

  tick (state) {
    const newState = this.before(state, this)
    const ogResult = this.node.tick(newState)
    return this.after(ogResult, this, state)
  }

  bind (node) {
    this.node = node
    return this
  }
}

const not = (node) => new Decorator('not', {
  after: result => {
    if (result === Status.Success) {
      return Status.Failure
    } else if (result === Status.Failure) {
      return Status.Success
    } else {
      return result
    }
  }
}).bind(node)

const delay = (node) => new Decorator('delay', {
  after: (result, self, state) => {
    if (self._storedResult) {
      state.warrior.think(``)
      const value = self._storedResult
      self._storedResult = null
      self.should_skip = false
      return value
    } else {
      self._storedResult = result
      self.should_skip = true
      return Status.Running
    }
  }
}).bind(node)

const until = (node, pred) => new Decorator('until', {
  before: (state, self) => {
    const done = pred(state)
    if (done) {
      self.should_skip = true
      self.done = true
      return state
    } else {
      return state
    }
  },
  after: (result, self, state) => {
    if (result !== Status.Failure) {
      if (self.done) {
        self.should_skip = false
        self.done = false
        return Status.Success
      }
      return Status.Running
    } else {
      return result
    }
  }
}).bind(node)

const delayAll = (nodes) => nodes.map(delay)

/**
 * Warrior Actions
 */
const walk = (direction = 'forward') => new Action('walk', ({warrior}) => {
  warrior.walk(direction)
  return Status.Success
})

const isSpaceEmpty = () => new Action('is_space_empty', ({warrior}) => {
  const space = warrior.feel()
  if (space.isEmpty()) {
    return Status.Success
  } else {
    return Status.Failure
  }
})

const checkForEnemy = () => new Action('checkForEnemy', ({warrior}) => {
  const unit = warrior.feel().getUnit()
  return unit && unit.isEnemy() ? Status.Success : Status.Failure
})

const checkForCaptive = () => new Action('checkForEnemy', ({warrior}) => {
  const unit = warrior.feel().getUnit()
  return unit && unit.isBound() ? Status.Success : Status.Failure
})

const lookforCaptiveAhead = (n, direction = 'forward') => new Action('look ahead captive', ({warrior}) => {
  const spaces = warrior.look(direction)
  const unit = spaces[n - 1] && spaces[n - 1].getUnit()
  return unit && unit.isBound() ? Status.Success : Status.Failure
})

const lookforEnemyAhead = (n) => new Action('look ahead enemy', ({warrior}) => {
  const spaces = warrior.look()
  const unit = spaces[n - 1] && spaces[n - 1].getUnit()
  return unit && unit.isEnemy() ? Status.Success : Status.Failure
})

const checkForWall = (n) => new Action('check for wall', ({warrior}) => {
  const space = warrior.feel()
  return space && space.isWall() ? Status.Success : Status.Failure
})

const isSpaceNotEmpty = () => not(isSpaceEmpty())

const checkForDamage = () => new Action('check for damage', ({warrior, oldStats}) => {
  const tookDamage = warrior.health() < oldStats.health
  return tookDamage ? Status.Success : Status.Failure
})

const fight = () => new Action('fight', ({warrior}) => {
  warrior.attack()
  return Status.Success
})

const shoot = () => new Action('shoot', ({warrior}) => {
  warrior.shoot()
  return Status.Success
})

const trurnAround = () => new Action('turnAround', ({warrior}) => {
  warrior.pivot()
  return Status.Success
})

const rest = () => new Action('reset', ({warrior}) => {
  warrior.rest()
  return Status.Success
})

const rescue = () => new Action('rescue', ({warrior}) => {
  warrior.rescue()
  return Status.Success
})

const hasLowHealth = (percent) => new Action('lowHealth', ({warrior}) => {
  // Health is low if health is less than 10%
  const max = warrior.maxHealth()
  const current = warrior.health()
  const threshold = max * percent
  if (current <= threshold) {
    return Status.Success
  } else {
    return Status.Failure
  }
})

const moveForword = () => new Sequence('move_forword')
  .addChild(isSpaceEmpty())
  .addChild(walk())

const healIfLow = () => new Sequence('heal_if_low', true)
  .addChild(hasLowHealth(0.4))
  .addChild(until(rest(), ({warrior}) => {
    return warrior.health() === warrior.maxHealth()
  }))

const ifEnemeyFight = () => new Sequence('if_enemy_fight')
  .addChild(checkForEnemy())
  .addChild(fight())

const ifCaptiveRescue = () => new Sequence('if_captive_resuce')
  .addChild(checkForCaptive())
  .addChild(rescue())

const isCaptiveBehind = () => new Selector('is captive behind')
  .addChild(lookforCaptiveAhead(1, 'backward'))
  .addChild(lookforCaptiveAhead(2, 'backward'))
  .addChild(lookforCaptiveAhead(3, 'backward'))

const turnForCaptive = () => new Sequence('turn for the captive')
  .addChild(isCaptiveBehind())
  .addChild(trurnAround())

const shootIfBadGuy = () => new Sequence('shoot the bad guys', true)
  .addChild(not(lookforCaptiveAhead(1)))
  .addChild(not(lookforCaptiveAhead(2)))
  .addChild(lookforEnemyAhead(3))
  .addChild(delay(shoot()))
  .addChild(lookforEnemyAhead(3))
  .addChild(walk())

const retreatIfTakingTooMuchDamage = () => new Sequence('retreat if takin damage')
  .addChild(checkForDamage())
  .addChild(hasLowHealth(0.4))
  .addChild(walk('backward'))

const ifWallTurnAround = () => new Sequence('if wall turn around')
  .addChild(checkForWall())
  .addChild(trurnAround())

const behavior = new Selector('walk_or_fight', true)
  .addChild(turnForCaptive())
  .addChild(ifEnemeyFight())
  .addChild(shootIfBadGuy())
  .addChild(ifWallTurnAround())
  .addChild(retreatIfTakingTooMuchDamage())
  .addChild(ifCaptiveRescue())
  .addChild(healIfLow())
  .addChild(moveForword())

class Player {
  constructor () {
    this.behavior = behavior
    this.stats = null
  }

  initStats (warrior) {
    this.stats = {
      health: warrior.maxHealth()
    }
    return this.stats
  }

  getStats () {
    return this.stats
  }

  saveStats (warrior) {
    this.stats = {
      health: warrior.health()
    }
  }

  playTurn (warrior) {
    const stats = this.getStats() || this.initStats(warrior)
    const state = {
      oldStats: stats,
      warrior: warrior
    }
    this.behavior.tick(state)
    this.saveStats(warrior)
  }
}
