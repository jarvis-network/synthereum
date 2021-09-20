import { Observable, BehaviorSubject, interval, startWith } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface Result {
  changeInterval: (interval: number) => void;
  interval$: Observable<number>;
  intervalSubject: BehaviorSubject<number>;
}
export const dynamicInterval = (defaultInterval = 10000): Result => {
  const intervalSubject = new BehaviorSubject<number>(defaultInterval);
  const interval$ = intervalSubject.pipe(
    switchMap(intervalDuration =>
      interval(intervalDuration).pipe(startWith(0)),
    ),
  );

  return {
    changeInterval: newInterval => intervalSubject.next(newInterval),
    interval$,
    intervalSubject,
  };
};
