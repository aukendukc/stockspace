import ProfileScreen from "../profile/profile";
import { SwipeableTabsWrapper } from "../../components/SwipeableTabsWrapper";

export default function ProfileTabScreen() {
  return (
    <SwipeableTabsWrapper>
      <ProfileScreen />
    </SwipeableTabsWrapper>
  );
}

