import { useScrollToTop } from "expo-router";
import type { RefObject } from "react";

/**
 * Tapping the tab you are on scrolls its list back to the top, as iOS tab bars do (the dock sends the
 * navigator's `tabPress`). expo-router's types predate React Native 0.88's list refs, hence the cast:
 * at run time it takes a ScrollView, FlatList or SectionList.
 */
export const useTabScrollToTop = (ref: RefObject<unknown>) => useScrollToTop(ref as Parameters<typeof useScrollToTop>[0]);
