'use client';

/**
 * RegionCountryFilter — three-level Region / Country / Location slicer
 * for the Ops Dashboard, rendered as a row of multi-select dropdowns.
 *
 * Hierarchy:
 *   Region (AMER / EMEA / APAC)
 *     └─ Country (US / UK / Singapore / China / …)
 *           └─ Location (US-California-Palo Alto / Singapore-CapitaSky / …)
 *
 * Layout:
 *  - **Region** dropdown (no grouping). Selecting one or more narrows
 *    the country & location pools downstream.
 *  - **Country** dropdown — the leading country token (`extractCountry`)
 *    of every classifiable location in `rows`. Options are *grouped by
 *    their region* so the popover reads "AMER → Brazil, Canada,
 *    Mexico, US — EMEA → France, Germany, …".
 *  - **Location** dropdown — the full location string. Options are
 *    *grouped by their country* so each country's sites cluster.
 *  - "Showing N countries / M locations …" footer below summarises the
 *    pool sizes given the current Region selection.
 *  - **Clear All Filters** button at the end (opt-in via
 *    `showClearButton`). Pages that surface their own clear button
 *    elsewhere should pass `showClearButton={false}`.
 *
 * Cascade rules (enforced by effect):
 *  - Narrowing the Region selection drops any selected country whose
 *    region is no longer in the union, and any selected location
 *    whose country is no longer in the union.
 *  - Narrowing the Country selection drops any selected location
 *    whose country is no longer in the union.
 *
 * State is fully controlled by the parent.
 */

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import {
    REGIONS,
    countryToLocations,
    extractCity,
    regionToCountries,
} from '@/lib/ops_dashboard/region';
import type { Region } from '@/components/ops_dashboard/RegionMap';
import { MultiSelect, type SlicerOption } from './MultiSelect';

export interface RegionCountryFilterProps<T> {
    /** Rows used to derive the country + location pools. */
    rows: T[];
    /** Full location string extractor (e.g. "US-California-Palo Alto"). */
    getLocation: (row: T) => string | null | undefined;
    selectedRegions: Region[];
    selectedCountries: string[];
    selectedLocations: string[];
    onRegionsChange: (next: Region[]) => void;
    onCountriesChange: (next: string[]) => void;
    onLocationsChange: (next: string[]) => void;
    /**
     * Number of *other* active filters owned by the parent (Open Date,
     * donut chart filters, …). Drives the "Clear All Filters" enabled
     * state alongside this component's own selection.
     */
    extraActiveCount?: number;
    /** Clears parent-owned filters when "Clear All Filters" fires. */
    onClearAll?: () => void;
    countrySearchPlaceholder?: string;
    locationSearchPlaceholder?: string;
    /**
     * Render the inline "Clear All Filters" button at the bottom of
     * the dropdown grid. Default `true`. Pages that surface their own
     * Clear button elsewhere (e.g. via `TopFilterBar.headerActions`)
     * should set this to `false` to avoid duplication.
     */
    showClearButton?: boolean;
}

export function RegionCountryFilter<T>({
    rows,
    getLocation,
    selectedRegions,
    selectedCountries,
    selectedLocations,
    onRegionsChange,
    onCountriesChange,
    onLocationsChange,
    extraActiveCount = 0,
    onClearAll,
    countrySearchPlaceholder,
    locationSearchPlaceholder,
    showClearButton = true,
}: RegionCountryFilterProps<T>) {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // ----- Region → countries map (full dataset). -----
    const countriesByRegion = useMemo(
        () => regionToCountries(rows, getLocation),
        [rows, getLocation],
    );

    // ----- Country → locations map (full dataset). -----
    const locationsByCountry = useMemo(
        () => countryToLocations(rows, getLocation),
        [rows, getLocation],
    );

    // ----- Visible country list given Region selection. -----
    const visibleCountries = useMemo(() => {
        const pool = selectedRegions.length === 0 ? REGIONS : selectedRegions;
        const union = new Set<string>();
        for (const r of pool) for (const c of countriesByRegion[r]) union.add(c);
        return [...union];
    }, [countriesByRegion, selectedRegions]);

    // ----- Visible location list given Country (and indirectly Region) selection. -----
    const visibleLocations = useMemo(() => {
        // Country pool we care about — explicit selection if any, else
        // every visible country (which is itself region-narrowed).
        const countryPool = selectedCountries.length === 0 ? visibleCountries : selectedCountries;
        const union = new Set<string>();
        for (const c of countryPool) {
            const locs = locationsByCountry[c];
            if (!locs) continue;
            for (const l of locs) union.add(l);
        }
        return [...union];
    }, [locationsByCountry, visibleCountries, selectedCountries]);

    const hasAnyCountry = visibleCountries.length > 0;
    const hasAnyLocation = visibleLocations.length > 0;

    // ----- Cascade cleanup -----
    // When Region narrows, drop selected countries that no longer belong.
    useEffect(() => {
        if (selectedCountries.length === 0) return;
        const allowed = new Set(visibleCountries);
        const next = selectedCountries.filter((c) => allowed.has(c));
        if (next.length !== selectedCountries.length) onCountriesChange(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleCountries]);

    // When Region or Country narrows, drop locations that no longer belong.
    useEffect(() => {
        if (selectedLocations.length === 0) return;
        const allowed = new Set(visibleLocations);
        const next = selectedLocations.filter((l) => allowed.has(l));
        if (next.length !== selectedLocations.length) onLocationsChange(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleLocations]);

    // ----- Build dropdown options (Country grouped by Region; Location grouped by Country) -----
    const regionOptions: SlicerOption[] = REGIONS.map((r) => ({ value: r, label: r }));
    const regionSelectedAsStrings = selectedRegions as unknown as string[];
    const onRegionMultiChange = (next: string[]) => {
        onRegionsChange(next.filter((v): v is Region => REGIONS.includes(v as Region)));
    };

    const countryOptions: SlicerOption[] = useMemo(() => {
        // Walk REGIONS in canonical order (AMER → EMEA → APAC) so the
        // popover always reads in the same direction. Within a region,
        // countries are alphabetical (regionToCountries already sorts).
        const out: SlicerOption[] = [];
        for (const r of REGIONS) {
            if (selectedRegions.length > 0 && !selectedRegions.includes(r)) continue;
            for (const c of countriesByRegion[r]) {
                out.push({ value: c, label: c, group: r });
            }
        }
        return out;
    }, [countriesByRegion, selectedRegions]);

    const locationOptions: SlicerOption[] = useMemo(() => {
        // Group by **city** (second segment of the location string),
        // walking countries in alphabetical order. So Palo Alto /
        // Irvine / Los Angeles all sit under a "California" header,
        // CapitaSky / CapitaSpring under "Singapore" etc. Locations
        // with no second segment (e.g. "Hong Kong") fall back to
        // their canonical country name as the group label.
        const countryPool = selectedCountries.length === 0 ? visibleCountries : selectedCountries;
        const sortedCountries = [...countryPool].sort();
        const out: SlicerOption[] = [];
        for (const c of sortedCountries) {
            const locs = locationsByCountry[c];
            if (!locs) continue;
            const sortedLocs = [...locs].sort((a, b) => {
                const cityA = extractCity(a) || c;
                const cityB = extractCity(b) || c;
                return cityA.localeCompare(cityB) || a.localeCompare(b);
            });
            for (const l of sortedLocs) {
                const groupLabel = extractCity(l) || c;
                out.push({ value: l, label: l, group: groupLabel });
            }
        }
        return out;
    }, [locationsByCountry, visibleCountries, selectedCountries]);

    // ----- Footer -----
    const ownActiveCount = selectedRegions.length + selectedCountries.length + selectedLocations.length;
    const hasActive = ownActiveCount + extraActiveCount > 0;

    function clearAll() {
        if (selectedRegions.length > 0) onRegionsChange([]);
        if (selectedCountries.length > 0) onCountriesChange([]);
        if (selectedLocations.length > 0) onLocationsChange([]);
        onClearAll?.();
    }

    function regionsLabel(): string {
        if (selectedRegions.length === 0) return t('filters.scopeAllRegions');
        return t('filters.scopeInItems', { items: selectedRegions.join(', ') });
    }

    function countriesLabel(): string {
        if (selectedCountries.length === 0) return regionsLabel();
        if (selectedCountries.length <= 3) {
            return t('filters.scopeInItems', { items: selectedCountries.join(', ') });
        }
        return t('filters.scopeInItemsPlus', {
            items: selectedCountries.slice(0, 2).join(', '),
            count: selectedCountries.length - 2,
        });
    }

    // ----- Theme -----
    const subtleCls = isLight ? 'text-slate-400' : 'text-gray-500';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Region dropdown */}
            <MultiSelect
                label={t('filters.region')}
                options={regionOptions}
                value={regionSelectedAsStrings}
                onChange={onRegionMultiChange}
            />

            {/* Country dropdown — grouped by Region. Hidden when there's
                no classifiable country in the dataset. */}
            {hasAnyCountry && (
                <div className="flex flex-col gap-1">
                    <MultiSelect
                        label={t('filters.country')}
                        options={countryOptions}
                        value={selectedCountries}
                        onChange={onCountriesChange}
                        searchable
                        searchPlaceholder={countrySearchPlaceholder ?? t('filters.searchCountry')}
                    />
                    <span className={`text-[11px] ${subtleCls}`}>
                        {t('filters.showingCountries', {
                            count: visibleCountries.length,
                            scope: regionsLabel(),
                        })}
                    </span>
                </div>
            )}

            {/* Location dropdown — grouped by Country. */}
            {hasAnyLocation && (
                <div className="flex flex-col gap-1">
                    <MultiSelect
                        label={t('filters.location')}
                        options={locationOptions}
                        value={selectedLocations}
                        onChange={onLocationsChange}
                        searchable
                        searchPlaceholder={locationSearchPlaceholder ?? t('filters.searchLocation')}
                    />
                    <span className={`text-[11px] ${subtleCls}`}>
                        {t('filters.showingLocations', {
                            count: visibleLocations.length,
                            scope: countriesLabel(),
                        })}
                    </span>
                </div>
            )}

            {showClearButton && (
                <div className="col-span-full flex">
                    <button
                        type="button"
                        onClick={hasActive ? clearAll : undefined}
                        disabled={!hasActive}
                        className={`text-xs rounded-lg px-3 py-1.5 border transition-colors ${
                            hasActive
                                ? isLight
                                    ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 cursor-pointer'
                                    : 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25 cursor-pointer'
                                : isLight
                                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        {t('filters.clearAllFilters')}
                    </button>
                </div>
            )}
        </div>
    );
}
