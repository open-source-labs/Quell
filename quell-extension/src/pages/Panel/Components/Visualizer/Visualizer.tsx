import styles from './Visualizer.modules.css';
import FlowTree from "./FlowTree";
import FlowTable from "./FlowTable";

export function Visualizer({ query, elapsed }: VisualizerProps) {
    return (
        <div className={styles.graphContainer}>
            <h3>Execution Tree</h3>
            <div className={styles.flowTree}>
                {/* <FlowTree query={query}/> */}
                <FlowTree query={query} elapsed={elapsed}/>
            </div>
            <h3> Execution Table </h3>
            {/* <div className={styles.flowTable}>
                <FlowTable query={query} elapsed={elapsed}/>
            </div> */}
        </div>
    );
}

interface VisualizerProps {
  query: string;
  elapsed: {};
}

