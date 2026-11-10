// The small part of the tour system that ordinary screens touch: a way to start a guide and to mark a view as
// something a guide can point at. The tour itself (cards, spotlight, saved state) lives in TourProvider.
import { ReactNode, createContext, useCallback, useContext } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import type { TourId } from './steps';

export type TourApi = {
  start: (id: TourId) => void;
  seen: TourId[];
  register: (target: string, node: unknown | null) => void;
};

export const TourContext = createContext<TourApi | null>(null);

// null outside the real app (for example in screen tests), where guides simply do not exist.
export const useTour = () => useContext(TourContext);

// Ref callback that lets a guide find (and measure) a view by name.
export function useTourRef(target: string) {
  const tour = useTour();
  const register = tour?.register;
  return useCallback((node: unknown | null) => { register?.(target, node); }, [register, target]);
}

export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useTourRef(id);
  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}
