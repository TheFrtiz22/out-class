import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Text } from "~/components/text";
import { Press, TARGET } from "~/components/ui";
import { AVAILABILITY_END_SLOT, AVAILABILITY_FIRST_SLOT, hourLabel, minuteLabel, paintSlots } from "~/lib/availability";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

const ROW = TARGET;
const LABEL = 58;
const GAP = 4;
const HOURS = Array.from({ length: (AVAILABILITY_END_SLOT - AVAILABILITY_FIRST_SLOT) / 4 }, (_, i) => AVAILABILITY_FIRST_SLOT + i * 4);

/**
 * One day's 8 AM–9 PM availability as hour rows of four quarter hours (the web's weekly calendar,
 * one day at a time as it shows on a phone). Tap a quarter hour to add or remove it, tap an hour to
 * set the whole hour, or touch and hold, then drag, to paint a range. `known` false draws the day
 * as not submitted (unknown), not as unavailable.
 */
export function DayGrid({ cells, known, dayName, onChange, readOnly, testID = "availability-grid" }: {
  cells: boolean[]; known: boolean; dayName: string; onChange?: (cells: boolean[]) => void; readOnly?: boolean; testID?: string;
}) {
  const { colors, radius } = useTheme();
  const [preview, setPreview] = useState<boolean[] | null>(null);
  const width = useRef(0);
  const drag = useRef<{ from: number; on: boolean } | null>(null);
  const shown = preview ?? cells;

  const slotAt = (x: number, y: number) => {
    const columns = width.current - LABEL;
    if (columns <= 0) return null;
    const row = Math.floor(y / (ROW + GAP)), column = Math.floor((x - LABEL) / (columns / 4));
    if (row < 0 || row >= HOURS.length || column < 0 || column > 3) return null;
    return HOURS[row] + column;
  };
  const paint = Gesture.Pan()
    .withTestId(`${testID}-paint`)
    .runOnJS(true)
    .enabled(!readOnly && !!onChange)
    .activateAfterLongPress(220)
    .onStart(event => {
      const slot = slotAt(event.x, event.y);
      if (slot === null) return;
      drag.current = { from: slot, on: !cells[slot] };
      haptics.tick();
      setPreview(paintSlots(cells, slot, slot, !cells[slot]));
    })
    .onUpdate(event => {
      const active = drag.current, slot = slotAt(event.x, Math.max(0, event.y));
      if (!active || slot === null) return;
      setPreview(paintSlots(cells, active.from, slot, active.on));
    })
    .onEnd((event, success) => {
      const active = drag.current;
      drag.current = null;
      const slot = slotAt(event.x, Math.max(0, event.y));
      setPreview(null);
      if (success && active) onChange?.(paintSlots(cells, active.from, slot ?? active.from, active.on));
    })
    .onFinalize(() => { if (drag.current) { drag.current = null; setPreview(null); } });

  const toggle = (slot: number) => { if (readOnly || !onChange) return; haptics.tick(); onChange(paintSlots(cells, slot, slot, !cells[slot])); };
  const toggleHour = (start: number) => {
    if (readOnly || !onChange) return;
    const full = [0, 1, 2, 3].every(i => cells[start + i]);
    haptics.tick();
    onChange(paintSlots(cells, start, start + 3, !full));
  };

  return (
    <View testID={testID} accessibilityLabel={`${dayName} availability by quarter hour`}>
      <GestureDetector gesture={paint}>
        <View testID={`${testID}-rows`} onLayout={event => { width.current = event.nativeEvent.layout.width; }} style={{ gap: GAP }}>
          {HOURS.map(start => (
            <View key={start} style={{ flexDirection: "row", alignItems: "stretch", height: ROW, gap: GAP }}>
              <Press testID={`${testID}-hour-${start}`} disabled={readOnly} onPress={() => toggleHour(start)}
                accessibilityRole="button" accessibilityLabel={`${dayName} ${minuteLabel(start * 15)} to ${minuteLabel((start + 4) * 15)}`}
                accessibilityHint={readOnly ? undefined : "Sets the whole hour"}
                style={{ width: LABEL - GAP, justifyContent: "center" }}>
                <Text variant="caption" numberOfLines={1}>{hourLabel(start * 15)}</Text>
              </Press>
              {[0, 1, 2, 3].map(i => {
                const slot = start + i, on = shown[slot];
                return (
                  <Press key={slot} testID={`${testID}-slot-${slot}`} disabled={readOnly} onPress={() => toggle(slot)}
                    accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !!readOnly }}
                    accessibilityLabel={`${dayName} ${minuteLabel(slot * 15)} to ${minuteLabel((slot + 1) * 15)}`}
                    style={{ flex: 1, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? colors.primary : known ? colors.card : colors.muted, borderStyle: known || on ? "solid" : "dashed" }} />
                );
              })}
            </View>
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}
