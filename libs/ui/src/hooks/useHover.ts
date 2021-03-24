import { useState, useEffect, useRef } from 'react';

export default function useHover<T extends HTMLElement>() {
  const [value, setValue] = useState(false);
  const ref = useRef<T>(null);

  const handleMouseOver = () => setValue(true);
  const handleMouseOut = () => setValue(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    node.addEventListener('mouseover', handleMouseOver);
    node.addEventListener('mouseleave', handleMouseOut);

    return () => {
      node.removeEventListener('mouseover', handleMouseOver);
      node.removeEventListener('mouseleave', handleMouseOut);
    };
  }, [ref.current]);

  return [ref, value] as const;
}
