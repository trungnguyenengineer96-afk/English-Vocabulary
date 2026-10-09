import { createContext, useContext } from 'react';
import type { Profile } from '../../core/profiles';

export interface ProfileContextValue {
  profile: Profile;
  switchProfile: () => void;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);
export const useProfile = () => useContext(ProfileContext);
