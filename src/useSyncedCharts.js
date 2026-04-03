import { useEffect } from "react";

export default function useSyncedCharts(charts) {
    useEffect(() => {
        if (!charts || charts.length === 0) return;

        let isSyncing = false;

        charts.forEach((chart) => {
            // 🔥 ZOOM + SCROLL SYNC
            chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (isSyncing) return;
                isSyncing = true;

                charts.forEach((c) => {
                    if (c !== chart) {
                        c.timeScale().setVisibleLogicalRange(range);
                    }
                });

                isSyncing = false;
            });

            // 🔥 CROSSHAIR SYNC
            chart.subscribeCrosshairMove((param) => {
                if (!param || !param.time || isSyncing) return;

                isSyncing = true;

                charts.forEach((c) => {
                    if (c !== chart) {
                        c.setCrosshairPosition(
                            param.point.x,
                            param.point.y,
                            param.time
                        );
                    }
                });

                isSyncing = false;
            });
        });
    }, [charts]);
}