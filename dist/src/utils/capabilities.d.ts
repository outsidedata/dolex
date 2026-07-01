export interface CapabilityDep {
    package: string;
    installed: boolean;
    version?: string;
    enables: string;
    install?: string;
}
export interface CapabilitiesReport {
    dolexVersion?: string;
    node: string;
    platform: string;
    coreOk: boolean;
    /** Per source type: 'ready' or an actionable 'needs: npm install …'. The agent's key question. */
    sources: {
        csv: string;
        postgres: string;
        mongodb: string;
    };
    deps: CapabilityDep[];
    python: {
        available: boolean;
        version?: string;
        enables: string;
        install?: string;
    };
}
/** Probe the current environment for optional capabilities. Pure of side effects; never throws. */
export declare function probeCapabilities(): CapabilitiesReport;
