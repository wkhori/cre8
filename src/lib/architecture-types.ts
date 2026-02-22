export interface ArchitectureComponent {
  id: string;
  name: string;
  description: string;
  techStack?: string;
  iconSlug?: string;
}

export interface ArchitectureLayer {
  name: string;
  tier: number;
  components: ArchitectureComponent[];
}

export interface ArchitectureConnection {
  from: string;
  to: string;
  label?: string;
  style: "arrow" | "double-arrow" | "line";
  lineStyle?: "solid" | "dashed" | "dotted";
}

export interface ArchitectureAnalysis {
  title: string;
  description?: string;
  layers: ArchitectureLayer[];
  connections: ArchitectureConnection[];
}
