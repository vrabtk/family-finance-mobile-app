import { Feather } from '@expo/vector-icons';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FadeIn } from '../motion';
import type { Route } from '../navigation';
import { loadPrefs, savePrefs } from '../storage';
import { colors, radius, shadow, space, type } from '../theme';
import { Button, IconButton, ProgressBar } from '../ui';
import { TourApi, TourContext } from './context';
import { Access, Rect, cardPlacement, cleanSeen, isLast, markSeen, shouldAutoStart, stepsFor, usableRect } from './logic';
import { TourId, TourStep, tourById } from './steps';

type Active = { id: TourId; steps: TourStep[]; index: number };

const PAD = 6; // breathing room around the highlighted view
const DIM = 'rgba(15, 23, 42, 0.66)';

// Runs the guides. It opens each step's screen, finds the view to point at, draws the spotlight and the card,
// remembers which guides were seen, and starts the complete tour by itself the first time the app is used.
export function TourProvider({ navigate, access, autoStart = true, children }: {
  navigate: (route: Route) => void; access: Access; autoStart?: boolean; children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const [active, setActive] = useState<Active | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [seen, setSeen] = useState<TourId[]>([]);
  const [loaded, setLoaded] = useState(false);
  const targets = useRef(new Map<string, any>());
  const autoStarted = useRef(false);

  useEffect(() => { loadPrefs().then((p) => { setSeen(cleanSeen(p.toursSeen)); setLoaded(true); }); }, []);

  const register = useCallback((target: string, node: unknown | null) => {
    if (node) targets.current.set(target, node); else targets.current.delete(target);
  }, []);

  const start = useCallback((id: TourId) => setActive({ id, steps: stepsFor(id, access), index: 0 }), [access]);

  const finish = useCallback((id: TourId) => {
    setActive(null);
    setRect(null);
    setSeen((prev) => {
      const next = markSeen(prev, id);
      if (next !== prev) loadPrefs().then((p) => savePrefs({ ...p, toursSeen: next }));
      return next;
    });
  }, []);

  // First run: the complete tour opens by itself, once per device.
  useEffect(() => {
    if (!autoStart || autoStarted.current || !shouldAutoStart(seen, loaded)) return;
    autoStarted.current = true;
    const timer = setTimeout(() => start('full'), 1200);
    return () => clearTimeout(timer);
  }, [autoStart, seen, loaded, start]);

  // Each step: open its screen, then find and measure the view it points at (the screen may need a moment to appear).
  const step = active ? active.steps[active.index] : undefined;
  useEffect(() => {
    if (!active || !step) return;
    setRect(null);
    if (step.route) navigate(step.route);
    const target = step.target;
    if (!target) return;
    const measure = () => {
      const node = targets.current.get(target);
      node?.measureInWindow?.((x: number, y: number, w: number, h: number) => setRect(usableRect({ x, y, width: w, height: h }, { width, height })));
    };
    const timers = [setTimeout(measure, step.route ? 500 : 150), setTimeout(measure, step.route ? 1100 : 600)];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.index]);

  const api = useMemo<TourApi>(() => ({ start, seen, register }), [start, seen, register]);

  const go = (delta: -1 | 1) => setActive((a) => (a ? { ...a, index: Math.max(0, Math.min(a.steps.length - 1, a.index + delta)) } : a));

  return (
    <TourContext.Provider value={api}>
      {children}
      {active && step && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => finish(active.id)}>
          <Spotlight rect={rect} />
          <Card
            tourTitle={tourById(active.id).title} step={step} index={active.index} total={active.steps.length} rect={rect} screenHeight={height}
            onBack={() => go(-1)} onNext={() => (isLast(active.index, active.steps.length) ? finish(active.id) : go(1))} onSkip={() => finish(active.id)}
          />
        </Modal>
      )}
    </TourContext.Provider>
  );
}

// Dims everything except the highlighted view (four dark panels around a hole, plus a ring).
function Spotlight({ rect }: { rect: Rect | null }) {
  if (!rect) return <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />;
  const x = Math.max(0, rect.x - PAD);
  const y = Math.max(0, rect.y - PAD);
  const w = rect.width + PAD * 2;
  const h = rect.height + PAD * 2;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.panel, { left: 0, right: 0, top: 0, height: y }]} />
      <View style={[styles.panel, { left: 0, right: 0, top: y + h, bottom: 0 }]} />
      <View style={[styles.panel, { left: 0, width: x, top: y, height: h }]} />
      <View style={[styles.panel, { left: x + w, right: 0, top: y, height: h }]} />
      <View pointerEvents="none" style={[styles.ring, { left: x, top: y, width: w, height: h }]} />
    </View>
  );
}

function Card({ tourTitle, step, index, total, rect, screenHeight, onBack, onNext, onSkip }: {
  tourTitle: string; step: TourStep; index: number; total: number; rect: Rect | null; screenHeight: number;
  onBack: () => void; onNext: () => void; onSkip: () => void;
}) {
  const place = cardPlacement(rect, screenHeight);
  const last = isLast(index, total);
  const position = place === 'below' && rect ? { top: rect.y + rect.height + PAD + 14 }
    : place === 'above' && rect ? { bottom: screenHeight - rect.y + PAD + 14 }
    : { top: screenHeight * 0.22 };
  return (
    <View style={[styles.cardWrap, position]} pointerEvents="box-none">
      <FadeIn key={step.id} from={10}>
        <View style={styles.card} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <View style={styles.cardTop}>
            <View style={styles.badge}><Feather name={step.icon} size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={type.caption} numberOfLines={1}>{tourTitle}</Text>
              <Text style={type.small}>Step {index + 1} of {total}</Text>
            </View>
            <IconButton icon="x" label="Close the guide" onPress={onSkip} />
          </View>
          <Text style={[type.heading, { marginTop: space.md }]}>{step.title}</Text>
          <Text style={[type.body, { marginTop: space.xs, color: colors.textDim }]}>{step.body}</Text>
          <View style={{ marginVertical: space.md }}><ProgressBar value={(index + 1) / total} tone="primary" /></View>
          <View style={styles.actions}>
            {index > 0 ? <Button label="Back" variant="secondary" small onPress={onBack} /> : <Button label="Skip" variant="ghost" small onPress={onSkip} />}
            <View style={{ flex: 1 }} />
            <Button label={last ? 'Done' : 'Next'} icon={last ? 'check' : 'arrow-right'} small onPress={onNext} />
          </View>
        </View>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', backgroundColor: DIM },
  ring: { position: 'absolute', borderRadius: radius.lg, borderWidth: 2, borderColor: colors.surface },
  cardWrap: { position: 'absolute', left: space.lg, right: space.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, ...shadow },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
