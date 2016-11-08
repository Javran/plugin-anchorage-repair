import React, { Component } from 'react'
import { connect } from 'react-redux'
import { createSelector  } from 'reselect'
import Inspector from 'react-inspector'
import _ from 'lodash'


// Import selectors defined in poi
import {
  fleetsSelector,
  shipsSelector,
  equipsSelector,
  repairsSelector,
  createDeepCompareArraySelector,
} from 'views/utils/selectors'


const AKASHI_ID = [182, 187] // akashi and kai ID in $ships
const SRF_ID = 86 // Ship Repair Facility ID in $slotitems
const AKASHI_INTERVAL = 20 * 60 * 1000 // minimum time required, in ms
const DOCKING_OFFSET = 30 * 1000 // offset in docking time formula
const MINOR_PERCENT = 0.5 // minor damage determination


// estimate the time needed in anchorage repair
const akashiEstimate = ({api_nowhp, api_maxhp, api_ndock_time}) => {

  if (api_ndock_time === 0 || api_nowhp >= api_maxhp) return 0

  if (api_nowhp < api_maxhp * MINOR_PERCENT) return 0 // damage check

  return Math.max(api_ndock_time, AKASHI_INTERVAL)
}

const timePerHPCalc = ({api_nowhp, api_maxhp, api_ndock_time}) => {
  return (api_nowhp < api_maxhp && api_nowhp >= api_maxhp * MINOR_PERCENT) ?
  ((api_ndock_time - DOCKING_OFFSET) / (api_maxhp - api_nowhp)) :
  0
}

// check a fleet status, returns information related to anchorage repair
const fleetAkashiConv = (fleet, ships, equips, repairId) => {

  const pickKey = ['api_id', 'api_ship_id', 'api_lv', 'api_nowhp', 'api_maxhp', 'api_ndock_time']

  let canRepair = false
  let akashiFlagship =false
  let repairCount = 0
  let inExpedition = _.get(fleet,'api_mission.0') && true
  let flagShipInRepair = _.includes(repairId, _.get(fleet, 'api_ship.0', -1))
  let flagship = ships[_.get(fleet, 'api_ship.0', -1)]

  if (flagship != null) {
    akashiFlagship = _.includes(AKASHI_ID, flagship.api_ship_id)
    repairCount = _.filter(flagship.api_slot, (item) => {
      return (_.get(equips, `${item}.api_slotitem_id`, -1) === SRF_ID).length + 2
    })
  }

  canRepair = akashiFlagship && !inExpedition && !flagShipInRepair

  let repairDetail = []
  _.forEach(fleet.api_ship, (shipId, index) => {

    if (shipId == -1) return false // break, LODASH ONLY

    let ship = _.pick(ships[shipId], pickKey)

    repairDetail.push({
      ...ship,
      estimate: akashiEstimate(ship),
      timePerHP: timePerHPCalc(ship),
      inRepair: _.includes(repairId, ship.api_id),
      availableSRF: index < repairCount,
    })
  })

  return {
    api_id: fleet.api_id || -1,
    shipId: fleet.api_ship || [],
    canRepair,
    repairCount,
    repairDetail,
  }
}

// selectors

const repairIdSelector = createSelector(
  [repairsSelector],
  (repair) => _.map(repair, (dock) => dock.api_ship_id)
)


const fleetsAkashiSelector = createSelector(
  [
    fleetsSelector,
    shipsSelector,
    equipsSelector,
    repairIdSelector,
  ],
  (fleets, ships, equips, repairId) => {
    return {fleets: _.map(fleets, fleet => fleetAkashiConv(fleet, ships, equips, repairId))}
  }
)



// React

export const reactClass = connect(
  createDeepCompareArraySelector([fleetsAkashiSelector], (data) => data )
)(class PluginAnchorageRepair extends Component {

  constructor(props) {
    super(props)

    this.state = {
      lastRefresh: Array(4).fill(0),
    }
  }

  componentDidMount= () => {
    window.addEventListener('game.response', this.handleResponse)
  }

  componentWillUnmount = () => {
    window.removeEventListener('game.response', this.handleResponse)
  }

  resetRefresh = (fleetId) => {
    let _tmp
    if (_.includes([1, 2, 3, 4], fleetId)) {
      _tmp = this.state.lastRefresh.slice()
      _tmp[fleetId -1] = Date.now()
      this.setState({lastRefresh: _tmp})
    }
  }

  reSchedule = () =>{
    // TODO: reSchedule
  }

  handleResponse = (e) => {
    const {path, body, postBody} = e.detail
    let fleetId, shipId, infleet
    switch (path) {
    case '/kcsapi/api_port/port':
      this.setState({lastRefresh: Array(4).fill(Date.now())})
      break
    case '/kcsapi/api_req_hensei/change':
      fleetId = parseInt(postBody.api_id)
      this.resetRefresh(fleetId)
      break
    case '/kcsapi/api_req_nyukyo/start':
      shipId = parseInt(postBody.api_ship_id)
      infleet = _.filter(this.props.fleets, fleet => _.includes(fleet.shipId, shipId))
      if (postBody.api_highspeed == 1 && infleet != null) {
        fleetId = infleet[0].api_id
        this.resetRefresh(fleetId)
      }
      break
    }
  }

  componentWillReceiveProps(nextProps) {
    console.log(this.props, this.state)
  }

  render() {
    return (
      <div>
        <h1>Test</h1>
        <Inspector data={[this.props, this.state]} theme="chromeDark" />
      </div>
    )
  }
})