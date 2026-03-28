/**
 * Chart Renderer - Canvas-based pie and bar charts
 */
HB.UI = HB.UI || {};

HB.UI.chartRenderer = {
    /**
     * Draw a pie chart on a canvas
     * @param {HTMLCanvasElement} canvas
     * @param {Array<{name, value, color}>} data
     */
    drawPieChart(canvas, data) {
        if (!canvas || !data || data.length === 0) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, W, H);

        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (total <= 0) return;

        const cx = W * 0.35;
        const cy = H * 0.5;
        const radius = Math.min(cx - 10, cy - 10) * 0.85;

        let startAngle = -Math.PI / 2;

        // Draw slices
        data.forEach((item, i) => {
            const sliceAngle = (item.value / total) * Math.PI * 2;
            const endAngle = startAngle + sliceAngle;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();

            // Slice border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Percentage label on slice (for slices > 10%)
            if (item.value / total > 0.08) {
                const midAngle = startAngle + sliceAngle / 2;
                const labelR = radius * 0.65;
                const lx = cx + Math.cos(midAngle) * labelR;
                const ly = cy + Math.sin(midAngle) * labelR;
                const pct = ((item.value / total) * 100).toFixed(0);

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${pct}%`, lx, ly);
            }

            startAngle = endAngle;
        });

        // Legend
        const legendX = W * 0.62;
        let legendY = 16;
        const legendSpacing = 22;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        data.forEach((item, i) => {
            const y = legendY + i * legendSpacing;

            // Color box
            ctx.fillStyle = item.color;
            ctx.fillRect(legendX, y - 5, 12, 12);

            // Label
            ctx.fillStyle = '#333';
            ctx.font = '11px -apple-system, sans-serif';

            // Truncate long names
            let name = item.name;
            if (name.length > 16) name = name.substring(0, 15) + '...';
            ctx.fillText(name, legendX + 16, y + 1);

            // Value
            ctx.fillStyle = '#666';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.fillText(HB.Utils.formatCurrency(item.value), legendX + 16, y + 13);
        });
    },

    /**
     * Draw a bar chart
     * @param {HTMLCanvasElement} canvas
     * @param {Array<{label, value, color}>} data
     * @param {Object} options
     */
    drawBarChart(canvas, data, options = {}) {
        if (!canvas || !data || data.length === 0) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, W, H);

        const pad = { top: 20, bottom: 40, left: 60, right: 20 };
        const plotW = W - pad.left - pad.right;
        const plotH = H - pad.top - pad.bottom;

        const maxVal = Math.max(...data.map(d => d.value));
        const barWidth = Math.min(40, (plotW / data.length) * 0.7);
        const gap = (plotW - barWidth * data.length) / (data.length + 1);

        // Y axis
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = pad.top + (plotH / 5) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(W - pad.right, y);
            ctx.stroke();

            const val = maxVal * (5 - i) / 5;
            ctx.fillStyle = '#999';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(HB.Utils.formatNumber(val), pad.left - 6, y);
        }

        // Bars
        data.forEach((item, i) => {
            const x = pad.left + gap + i * (barWidth + gap);
            const barH = (item.value / maxVal) * plotH;
            const y = pad.top + plotH - barH;

            ctx.fillStyle = item.color || '#4a90d9';
            ctx.fillRect(x, y, barWidth, barH);

            // Label
            ctx.fillStyle = '#333';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Truncate label
            let label = item.label;
            if (label.length > 10) label = label.substring(0, 9) + '..';
            ctx.fillText(label, x + barWidth / 2, pad.top + plotH + 6);
        });
    }
};
