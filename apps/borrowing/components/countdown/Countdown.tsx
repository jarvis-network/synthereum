import React from 'react';
import { styled } from '@jarvis-network/ui';
import { DateTime, Duration } from 'luxon';

const Timer = styled.p`
  margin-top: 10px;
  text-align: center;
  font-size: 30px;
`;

interface CountDownProps {
  endDate: DateTime;
  completeCB: () => void;
}
const CountDownTimer: React.FC<CountDownProps> = ({ endDate, completeCB }) => {
  const currentTime = DateTime.now();
  const diff = endDate.diff(currentTime);
  const diffCountdown = Duration.fromObject(diff.toObject())
    .toFormat('hh:mm:ss')
    .split(':');

  const [[hrs, mins, secs], setTime] = React.useState([
    parseInt(diffCountdown[0], 10),
    parseInt(diffCountdown[1], 10),
    parseInt(diffCountdown[2], 10),
  ]);
  const reset = () => completeCB();

  const tick = () => {
    if (hrs <= 0 && mins <= 0 && secs <= 0) reset();
    else if (mins === 0 && secs === 0) {
      setTime([hrs - 1, 59, 59]);
    } else if (secs === 0) {
      setTime([hrs, mins - 1, 59]);
    } else {
      setTime([hrs, mins, secs - 1]);
    }
  };

  React.useEffect(() => {
    const timerId = setInterval(() => tick(), 1000);
    return () => clearInterval(timerId);
  });
  return (
    <div>
      {diff.milliseconds > 0 && (
        <Timer>{`${hrs.toString().padStart(2, '0')}:${mins
          .toString()
          .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`}</Timer>
      )}
    </div>
  );
};

export default CountDownTimer;
