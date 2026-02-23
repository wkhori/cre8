export interface ArchitectureComponent {
  id: string;
  name: string;
  description?: string;
  techStack?: string;
  iconSlug?: string;
}

export interface ArchitectureLayer {
  name: string;
  description?: string;
  tier: number;
  section?: string;
  components: ArchitectureComponent[];
}

export interface ArchitectureConnection {
  from: string;
  to: string;
  label?: string;
  style: "arrow" | "double-arrow" | "line";
  lineStyle?: "solid" | "dashed" | "dotted";
  importance?: "primary" | "secondary" | "tertiary";
}

export interface ArchitectureAnalysis {
  title: string;
  description?: string;
  summary?: string;
  techStackIcons?: string[];
  colorTheme?: "warm" | "cool" | "earth" | "neon" | "ocean" | "mono";
  layoutHint?: "vertical" | "horizontal" | "bento";
  layers: ArchitectureLayer[];
  connections: ArchitectureConnection[];
}
