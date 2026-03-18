import { useState } from 'react';

interface ItemModalResult<T> {
  item: T | null;
  isOpen: boolean;
  open: (item: T) => void;
  close: () => void;
}

export function useItemModal<T>(): ItemModalResult<T> {
  const [item, setItem] = useState<T | null>(null);
  return {
    item,
    isOpen: item !== null,
    open: setItem,
    close: () => setItem(null),
  };
}
