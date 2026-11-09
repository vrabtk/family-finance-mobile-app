// Small motion helpers used by the Home dashboard. Kept in one module so tests can replace them with instant versions.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, LayoutAnimation, Platform, StyleProp, ViewStyle } from 'react-native';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// 0 -> 1 over `duration` ms (eased). Drives count-up numbers, ring fill and bar growth from one place.
export function useReveal(duration = 900, delay = 0): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    let frame = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const p = Math.min(1, (now - start) / duration);
        setT(easeOutCubic(p));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [duration, delay]);
  return t;
}

// Fade + slide up, staggered by `index`, so the dashboard assembles itself instead of popping in.
export function Reveal({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(value, { toValue: 1, duration: 450, delay: index * 90, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [value, index]);
  return (
    <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// True when the phone asks for less motion (Android "remove animations", iOS "reduce motion").
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setReduce(!!v); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return reduce;
}

// Smooth the next layout change (a field appearing, a card growing). Does nothing when motion is reduced.
export function easeNextLayout(reduce = false) {
  if (reduce) return;
  try { LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)); } catch { /* not supported here */ }
}

// Fades and slides its content in when it appears. Give it a `key` that changes with the content to replay it.
export function FadeIn({ children, style, from = 14 }: { children: ReactNode; style?: StyleProp<ViewStyle>; from?: number }) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { value.setValue(1); return; }
    Animated.timing(value, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [value, reduce]);
  return (
    <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Gently pulsing placeholder block for loading states.
export function Pulse({ style }: { style?: StyleProp<ViewStyle> }) {
  const value = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(value, { toValue: 0.45, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [value]);
  return <Animated.View style={[{ opacity: value }, style]} />;
}
