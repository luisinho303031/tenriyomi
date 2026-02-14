/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Navigate } from 'react-router-dom';
import { AppRoutes } from '@/base/AppRoute.constants.ts';

export function Browse() {
    return <Navigate to={AppRoutes.sources.childRoutes.browse.path('-1')} replace />;
}
