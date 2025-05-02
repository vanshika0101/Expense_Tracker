declare module 'react-native-svg-charts' {
  import { ViewStyle } from 'react-native';
  import { SvgProps } from 'react-native-svg';

  interface PieChartProps {
    style?: ViewStyle;
    data: Array<{
      value: number;
      svg: { fill: string };
      key: string;
      [key: string]: any;
    }>;
    innerRadius?: number;
    outerRadius?: number;
    labelRadius?: number;
    children?: React.ReactNode;
  }

  export const PieChart: React.FC<PieChartProps>;
} 