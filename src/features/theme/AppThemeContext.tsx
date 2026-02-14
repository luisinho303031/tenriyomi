/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Direction, ThemeProvider } from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import { AppTheme, getTheme } from '@/features/theme/services/AppThemes.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { MUI_THEME_MODE_KEY } from '@/lib/mui/MUI.constants.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { createAndSetTheme } from '@/features/theme/services/ThemeCreator.ts';
import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { DIRECTION_TO_CACHE } from '@/features/theme/ThemeDirectionCache.ts';
import { TAppThemeContext, ThemeMode } from '@/features/theme/AppTheme.types.ts';

export const AppThemeContext = React.createContext<TAppThemeContext>({
    appTheme: 'default',
    setAppTheme: (): void => { },
    themeMode: ThemeMode.SYSTEM,
    setThemeMode: (): void => { },
    shouldUsePureBlackMode: false,
    setShouldUsePureBlackMode: (): void => { },
    dynamicColor: null,
    setDynamicColor: (): void => { },
});

export const useAppThemeContext = (): TAppThemeContext => useContext(AppThemeContext);

export const AppThemeContextProvider = ({ children }: { children: ReactNode }) => {
    const { i18n } = useTranslation();
    const {
        settings: { appTheme: serverAppTheme, themeMode, shouldUsePureBlackMode, customThemes },
    } = useMetadataServerSettings();
    const [localAppTheme, setLocalAppThemeState] = useState<AppTheme>(() =>
        AppStorage.local.getItemParsed('appTheme', getTheme(serverAppTheme, customThemes))
    );
    const setLocalAppTheme = (theme: AppTheme) => {
        setLocalAppThemeState(theme);
        AppStorage.local.setItem('appTheme', theme);
    };

    const [localThemeMode, setLocalThemeModeState] = useState<ThemeMode>(() =>
        AppStorage.local.getItemParsed(MUI_THEME_MODE_KEY, themeMode)
    );
    const setLocalThemeMode = (mode: ThemeMode) => {
        setLocalThemeModeState(mode);
        AppStorage.local.setItem(MUI_THEME_MODE_KEY, mode);
    };

    const [localShouldUsePureBlackMode, setLocalShouldUsePureBlackModeState] = useState<boolean>(() =>
        AppStorage.local.getItemParsed('shouldUsePureBlackMode', shouldUsePureBlackMode)
    );
    const setLocalShouldUsePureBlackMode = (value: boolean) => {
        setLocalShouldUsePureBlackModeState(value);
        AppStorage.local.setItem('shouldUsePureBlackMode', value);
    };

    const directionRef = useRef<Direction>('ltr');

    const [systemThemeMode, setSystemThemeMode] = useState<ThemeMode>(MediaQuery.getSystemThemeMode());
    const [dynamicColor, setDynamicColor] = useState<TAppThemeContext['dynamicColor']>(null);



    const appTheme = localAppTheme.id;
    const actualThemeMode = localThemeMode;
    const shouldUsePureBlackModeValue = localShouldUsePureBlackMode;
    const currentDirection = i18n.dir();



    const appThemeContext = useMemo(
        () =>
            ({
                appTheme,
                setAppTheme: (value) => setLocalAppTheme(getTheme(value, customThemes)),
                themeMode: actualThemeMode,
                setThemeMode: (value) => setLocalThemeMode(value),
                shouldUsePureBlackMode: shouldUsePureBlackModeValue,
                setShouldUsePureBlackMode: (value) => setLocalShouldUsePureBlackMode(value),
                dynamicColor,
                setDynamicColor,
            }) satisfies TAppThemeContext,
        [actualThemeMode, shouldUsePureBlackMode, appTheme, dynamicColor],
    );

    const theme = useMemo(
        () =>
            createAndSetTheme(
                actualThemeMode as ThemeMode,
                getTheme(appTheme, { [localAppTheme.id]: localAppTheme, ...customThemes }),
                shouldUsePureBlackModeValue,
                currentDirection,
                dynamicColor,
            ),
        [
            actualThemeMode,
            currentDirection,
            systemThemeMode,
            shouldUsePureBlackModeValue,
            appTheme,
            customThemes,
            dynamicColor,
        ],
    );

    useLayoutEffect(() => {
        const unsubscribe = MediaQuery.listenToSystemThemeChange(setSystemThemeMode);

        return () => unsubscribe();
    }, []);



    useEffect(() => {
        // The set background color is not necessary anymore, since the theme has been loaded
        document.documentElement.style.backgroundColor = '';

        AppStorage.local.setItem('theme_background', theme.palette.background.default);
    }, [theme.palette.background.default]);

    if (directionRef.current !== currentDirection) {
        document.dir = currentDirection;
        directionRef.current = currentDirection;
    }

    return (
        <AppThemeContext.Provider value={appThemeContext}>
            <CacheProvider value={DIRECTION_TO_CACHE[currentDirection]}>
                <ThemeProvider theme={theme}>{children}</ThemeProvider>
            </CacheProvider>
        </AppThemeContext.Provider>
    );
};
