import React from 'react';
import ReactECharts from 'echarts-for-react';
import { TelemetryPoint } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';

interface TelemetryChartProps {
  data: TelemetryPoint[];
  interval: string;
  humidityMin?: number;
  humidityMax?: number;
  title?: string;
  subtitle?: string;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  data,
  interval,
  humidityMin = 15,
  humidityMax = 85,
  title,
  subtitle,
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === 'dark';

  const chartTitle = title || t('chart_title_olivos');
  const humidityLabel = `${t('soil_moisture')} (%)`;
  const temperatureLabel = `${t('temperature')} (°C)`;
  const neutronLabel = t('neutron_label');

  const timestamps = data.map((d) => {
    const rawTime = d.bucket || d.time || '';
    if (!rawTime) return '';
    try {
      return format(new Date(rawTime), interval === 'raw' || interval === '1m' || interval === '5m' ? 'HH:mm:ss' : 'dd/MM HH:mm');
    } catch {
      return rawTime;
    }
  });

  const humidities = data.map((d) => d.avg_humidity ?? d.humidity ?? null);
  const temperatures = data.map((d) => d.avg_temperature ?? d.temperature ?? null);
  const neutrons = data.map((d) => d.avg_neutron_counts ?? d.neutron_counts ?? null);

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: chartTitle,
      subtext: subtitle || '',
      textStyle: { color: isDark ? '#F8FAFC' : '#0F172A', fontSize: 13, fontWeight: '600', overflow: 'truncate', width: 480 },
      subtextStyle: { color: isDark ? '#94A3B8' : '#64748B', fontSize: 11 },
      left: '0',
      top: '0',
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderColor: isDark ? '#334155' : '#CBD5E1',
      textStyle: { color: isDark ? '#F8FAFC' : '#0F172A', fontSize: 12 },
      axisPointer: {
        type: 'cross',
        crossStyle: { color: '#64748B' },
      },
    },
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      data: [humidityLabel, temperatureLabel, neutronLabel],
      textStyle: { color: isDark ? '#94A3B8' : '#334155', fontSize: 11 },
      pageTextStyle: { color: isDark ? '#94A3B8' : '#334155' },
      pageIconColor: '#10B981',
      pageIconInactiveColor: isDark ? '#475569' : '#CBD5E1',
      left: 'center',
      bottom: '9%',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '24%',
      top: '16%',
      containLabel: true,
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 18,
        bottom: '0%',
        borderColor: isDark ? '#334155' : '#CBD5E1',
        backgroundColor: isDark ? '#111827' : '#F1F5F9',
        fillerColor: 'rgba(16, 185, 129, 0.15)',
        handleStyle: { color: '#10B981', borderColor: '#10B981' },
        textStyle: { color: isDark ? '#94A3B8' : '#334155' },
      },
    ],
    xAxis: {
      type: 'category',
      data: timestamps,
      boundaryGap: false,
      axisLine: { lineStyle: { color: isDark ? '#334155' : '#CBD5E1' } },
      axisLabel: { color: isDark ? '#94A3B8' : '#334155', fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '% / °C',
        nameTextStyle: { color: isDark ? '#94A3B8' : '#334155', fontSize: 11 },
        position: 'left',
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#CBD5E1' } },
        axisLabel: { color: isDark ? '#94A3B8' : '#334155', fontSize: 11 },
        splitLine: { lineStyle: { color: isDark ? '#1E293B' : '#E2E8F0', type: 'dashed' } },
        min: 0,
        max: 100,
      },
      {
        type: 'value',
        name: `N (${t('neutron_unit')})`,
        nameTextStyle: { color: isDark ? '#94A3B8' : '#334155', fontSize: 11 },
        position: 'right',
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#CBD5E1' } },
        axisLabel: { color: isDark ? '#94A3B8' : '#334155', fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: humidityLabel,
        type: 'line',
        smooth: true,
        showSymbol: data.length < 50,
        symbolSize: 6,
        data: humidities,
        itemStyle: { color: '#10B981' },
        lineStyle: { width: 3, color: '#10B981' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: humidityMax,
              lineStyle: { color: '#F43F5E', type: 'dashed', width: 1.5 },
              label: { formatter: `▲ ${humidityMax}%`, color: '#F43F5E', position: 'insideEndTop' },
            },
            {
              yAxis: humidityMin,
              lineStyle: { color: '#F59E0B', type: 'dashed', width: 1.5 },
              label: { formatter: `▼ ${humidityMin}%`, color: '#F59E0B', position: 'insideEndBottom' },
            },
          ],
        },
      },
      {
        name: temperatureLabel,
        type: 'line',
        smooth: true,
        showSymbol: data.length < 50,
        data: temperatures,
        itemStyle: { color: '#F59E0B' },
        lineStyle: { width: 2, color: '#F59E0B' },
      },
      {
        name: neutronLabel,
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: neutrons,
        itemStyle: { color: '#818CF8' },
        lineStyle: { width: 2, color: '#818CF8' },
      },
    ],
  };

  return (
    <div className="w-full h-80">
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

