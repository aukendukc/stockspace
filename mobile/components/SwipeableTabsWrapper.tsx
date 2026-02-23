import React, { ReactNode, useMemo } from "react";
import { View, PanResponder, PanResponderInstance, GestureResponderEvent, PanResponderGestureState } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";

const TAB_ROUTES = ["home", "stock", "sns", "pf", "profile"] as const;

interface SwipeableTabsWrapperProps {
  children: ReactNode;
}

export function SwipeableTabsWrapper({ children }: SwipeableTabsWrapperProps) {
  const navigation = useNavigation<any>();
  const currentTabIndex = useNavigationState((state) => {
    const routeName = state.routes[state.index]?.name;
    return TAB_ROUTES.indexOf(routeName as typeof TAB_ROUTES[number]);
  });

  const navigateTo = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= TAB_ROUTES.length) {
      return;
    }
    const routeName = TAB_ROUTES[targetIndex];
    if (routeName) {
      navigation.navigate(routeName as never);
    }
  };

  const panResponder = useMemo<PanResponderInstance>(() => {
    const handleRelease = (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const SWIPE_THRESHOLD = 60;
      if (gestureState.dx < -SWIPE_THRESHOLD) {
        navigateTo(currentTabIndex + 1);
      } else if (gestureState.dx > SWIPE_THRESHOLD) {
        navigateTo(currentTabIndex - 1);
      }
    };

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const horizontalMove = Math.abs(gestureState.dx);
        const verticalMove = Math.abs(gestureState.dy);
        return horizontalMove > verticalMove && horizontalMove > 15;
      },
      onPanResponderRelease: handleRelease,
      onPanResponderTerminate: handleRelease,
    });
  }, [currentTabIndex]);

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}




