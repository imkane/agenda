'use strict';
const humanInterval = require('human-interval');
const {CronTime} = require('cron');
const moment = require('moment-timezone');
const date = require('date.js');
const debug = require('debug')('agenda:job');

/**
 * Internal method used to compute next time a job should run and sets the proper values
 * @name Job#computeNextRunAt
 * @function
 * @returns {exports} instance of Job instance
 */
module.exports = function() {
  const interval = this.attrs.repeatInterval;
  const timezone = this.attrs.repeatTimezone;
  const {repeatAt} = this.attrs;
  this.attrs.nextRunAt = undefined;

  const dateForTimezone = date => {
    let date1 = moment(date).tz(timezone).format("YYYY-MM-DD HH:mm:ss").split(' ')[0]
    let time = moment(this.attrs.data.startTime).tz(timezone).format("YYYY-MM-DD HH:mm:ss").split(' ')[1]
    date = timezone?moment.tz(date1 + " " + time,timezone):date
    return date
  };

  /**
   * Internal method that computes the interval
   * @returns {undefined}
   */
  const computeFromInterval = () => {
    debug('[%s:%s] computing next run via interval [%s]', this.attrs.name, this.attrs._id, interval);
    let lastRun = this.attrs.lastRunAt || this.attrs.data.startTime || new Date();
    lastRun = dateForTimezone(lastRun)
    try {
      if (this.attrs.data.repeatData.type === 'months') {
        let lastRunArray = lastRun.toISOString().split('T')
        let lastRunArray1 = lastRunArray[0].split('-')
        let year = lastRunArray1[0]
        let month = lastRunArray1[1]
        let day = lastRunArray1[2]
        let intervalUnit = Number(this.attrs.data.repeatData.time.split('months')[0])
        let nextRunAt
        let foundNextAt = false
        let newMonth = Number(month)
        let newYear = Number(year)
        for (let i = 0; i <= 100; i++ ) {
          if(foundNextAt)
            break

          let newMonth1 = newMonth + intervalUnit
          if ( newMonth1 > 12 ) {
            let a = 12 - newMonth
            newMonth = intervalUnit - a
            newYear = newYear + 1
            let newDate = newMonth<10?newYear+'-0'+newMonth+'-'+day:newYear+'-'+newMonth+'-'+day
            if (moment(newDate).isValid()) {
              nextRunAt = newDate +'T'+lastRunArray[1]
              foundNextAt = true
            }
          } else {
            newMonth = newMonth1
            let newDate = newMonth<10?newYear+'-0'+newMonth+'-'+day:newYear+'-'+newMonth+'-'+day
            if (moment(newDate).isValid()) {
              nextRunAt = newDate +'T'+lastRunArray[1]
              foundNextAt = true
            }
          }
        }
        this.attrs.nextRunAt = dateForTimezone(nextRunAt)
        console.log(this.attrs.nextRunAt.toISOString())
        debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
      } else {
        const cronTime = new CronTime(interval);
        let nextDate = cronTime._getNextDateFrom(this.attrs.lastRunAt);
        if (nextDate.valueOf() === lastRun.valueOf()) {
          // Handle cronTime giving back the same date for the next run time
          nextDate = cronTime._getNextDateFrom(dateForTimezone(new Date(lastRun.valueOf() + 1000)));
        }
        this.attrs.nextRunAt = nextDate;
        console.log(this.attrs.nextRunAt.toISOString())
        debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
      }
    } catch (e) {
      // Nope, humanInterval then!
      try {
        if (!this.attrs.lastRunAt && humanInterval(interval)) {
          this.attrs.nextRunAt = lastRun.valueOf();
          console.log(this.attrs.nextRunAt.toISOString())
          debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
        } else {
          this.attrs.nextRunAt = dateForTimezone(lastRun.valueOf() + humanInterval(interval));
          console.log(this.attrs.nextRunAt.toISOString())
          debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
        }
      } catch (e) {}
    } finally {

      if (isNaN(this.attrs.nextRunAt)) {
        this.attrs.nextRunAt = undefined;
        debug('[%s:%s] failed to calculate nextRunAt due to invalid repeat interval', this.attrs.name, this.attrs._id);
        this.fail('failed to calculate nextRunAt due to invalid repeat interval');
      }
    }
  };

  /**
   * Internal method to compute next run time from the repeat string
   * @returns {undefined}
   */
  function computeFromRepeatAt() {
    const lastRun = this.attrs.lastRunAt || new Date();
    const nextDate = date(repeatAt).valueOf();

    // If you do not specify offset date for below test it will fail for ms
    const offset = Date.now();
    if (offset === date(repeatAt, offset).valueOf()) {
      this.attrs.nextRunAt = undefined;
      debug('[%s:%s] failed to calculate repeatAt due to invalid format', this.attrs.name, this.attrs._id);
      this.fail('failed to calculate repeatAt time due to invalid format');
    } else if (nextDate.valueOf() === lastRun.valueOf()) {
      this.attrs.nextRunAt = date('tomorrow at ', repeatAt);
      debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
    } else {
      this.attrs.nextRunAt = date(repeatAt);
      debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
    }
  }

  if (interval) {
    computeFromInterval.call(this);
  } else if (repeatAt) {
    computeFromRepeatAt.call(this);
  }
  return this;
};
