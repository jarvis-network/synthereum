import { useState, useEffect } from 'react';

export default function useKeyPressed(key: string): boolean {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (key.toLowerCase() === event.key.toLowerCase()) setPressed(true);
    };

    const onUp = (event: KeyboardEvent) => {
      if (key.toLowerCase() === event.key.toLowerCase()) setPressed(false);
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keydown', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keydown', onUp);
    };
  }, [key]);

  return pressed;
}
