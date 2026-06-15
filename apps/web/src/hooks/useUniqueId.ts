import { useId } from 'react';

export const useUniqueId = (prefix: string) => {
    const id = useId();
    return `${prefix}:${id}`;
};
