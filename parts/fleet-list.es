import React, { Component } from 'react'
import _ from 'lodash'
import {join} from 'path'
import {Table, Grid, Row, Col, OverlayTrigger, Tooltip, Label, Panel} from 'react-bootstrap'

import { CountupTimer } from './countup-timer'

import {ShipRow} from './ship-row'

const { ROOT, i18n } = window
const __ = i18n["poi-plugin-anchorage-repair"].__.bind(i18n["poi-plugin-anchorage-repair"])


export class FleetList extends Component {

  constructor(props) {
    super(props)

    this.state = {
      lastRefresh: 0,
      timeElapsed: 0,
    }
  }

  static basicNotifyConfig = {
    type: 'repair',
    title: __('Anchorage repair'),
    message: (names) => `${_.joinString(names, ', ')} ${__('anchorage repair completed')}`,
    icon: join(ROOT, 'assets', 'img', 'operation', 'repair.png'),
    preemptTime: 60,
  }

  componentDidMount= () => {
    window.addEventListener('game.response', this.handleResponse)
  }

  componentWillUnmount = () => {
    window.removeEventListener('game.response', this.handleResponse)
  }

  resetRefresh = (fleetId, time = Date.now()) => {
    let _tmp
    if (_.includes([1, 2, 3, 4], fleetId)) {
      _tmp = this.state.lastRefresh.slice()
      _tmp[fleetId -1] = time
      this.setState({lastRefresh: _tmp})
    }
  }

  handleResponse = (e) => {
    const {path, body, postBody} = e.detail
    let fleetId, shipId, infleet
    switch (path) {
    case '/kcsapi/api_port/port':
      this.setState({
        lastRefresh: Date.now(),
        timeElapsed: 0,
      })
      break

    case '/kcsapi/api_req_hensei/change':
      fleetId = parseInt(postBody.api_id)
      if (!Number.isNaN(fleetId)) this.setState({lastRefresh: 0})
      break

    case '/kcsapi/api_req_nyukyo/start':
      shipId = parseInt(postBody.api_ship_id)
      infleet = _.filter(this.props.fleet.shipId, id => shipId == id)
      if (postBody.api_highspeed == 1 && infleet != null) {
        this.setState({lastRefresh: Date.now()})
      }
      break
    }
  }

  tick = (timeElapsed) => {
    if (timeElapsed % 10 == 0) { // limit component refresh rate
      this.setState({timeElapsed: timeElapsed})
    }
  }

  resetTimeElapsed = () => {
    this.setState({timeElapsed: 0})
  }

  render(){
    let {timeElapsed, lastRefresh} = this.state
    const {fleet} = this.props

    return(
      <Grid>
        <Row className="info-row">
          <Col xs={4} className="info-col">
            <OverlayTrigger 
              placement="bottom" 
              trigger={fleet.canRepair ? 'manual' : ['hover','focus']} 
              id={`anchorage-refresh-notify-${fleet.api_id}`}
              overlay={
                <Tooltip>
                  <p>{fleet.akashiFlagship ? '' : __('Akashi not flagship')}</p>
                  <p>{fleet.inExpedition ? __('fleet in expedition') : ''}</p>
                  <p>{fleet.flagShipInRepair ? __('flagship in dock') : ''}</p>
                </Tooltip>
            }>
              <Label bsStyle={fleet.canRepair ? 'success' : 'warning'}>
                {fleet.canRepair ? __('Repairing') : __('Not ready')}
              </Label>
            </OverlayTrigger>
          </Col>
          <Col xs={4} className="info-col">
          { fleet.canRepair ?
              <Label bsStyle={this.state.lastRefresh ? 'success' : 'warning'}>
                <span>{__('Elapsed:')} </span>
                <CountupTimer
                  countdownId={`akashi-${fleet.api_id}`}
                  startTime={ this.state.lastRefresh}
                  tickCallback={this.tick}
                  startCallback={this.resetTimeElapsed}
                />
              </Label> :
              ''
          }
          </Col>
          <Col xs={4} className="info-col">
            <Label bsStyle={fleet.repairCount? 'success' : 'warning'}>{__('Capacity: %s', fleet.repairCount)}</Label>
          </Col>
        </Row>
        <Row>
          <Col xs={12}>
            <Panel bsStyle="warning" className={lastRefresh == 0 ? '' : 'hidden'}>
              {__('Please return to HQ screen to make timer refreshed.')}
            </Panel>
          </Col>
        </Row>
        <Row>
          <Col xs={12}>
            <Table bordered condensed>
              <thead>
                <tr>
                  <th>{__('Ship Name')}</th>
                  <th>{__('HP')}</th>
                  <th>{__('Akashi Time')}</th>
                  <th>{__('Per HP')}</th>
                  <th>{__('Estimated repaired')}</th>
                </tr>
              </thead>
              <tbody>
                {
                  _.map(fleet.repairDetail, (ship, index) => {
                    return(
                      <ShipRow
                        key={`anchorage-ship-${ship.api_id}`}
                        ship={ship}
                        lastRefresh={lastRefresh}
                        elapseTime={timeElapsed}
                        canRepair={fleet.canRepair}
                      />)
                  })
                }
              </tbody>
            </Table>
          </Col>
        </Row>
      </Grid>
    )
  }
}