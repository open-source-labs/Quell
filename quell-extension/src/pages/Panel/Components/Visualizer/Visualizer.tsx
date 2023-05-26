import styles from './Visualizer.modules.css';
import FlowTree from "./FlowTree";
import FlowTable from "./FlowTable";

export function Visualizer({ query, elapsed }: VisualizerProps) {
    console.log('in Visualizer, query is: ', query);
    console.log('in Visualizer, elapsed is: ', elapsed);
    
    const elapsedProp = elapsed !== null && elapsed !== undefined ? elapsed : {};

    return (
        <div className={styles.graphContainer}>
            <h3>Execution Tree</h3>
            <div className={styles.flowTree}>
                <FlowTree query={query} elapsed={elapsedProp}/>
            </div>
            <h3> Execution Table </h3>
            <div className={styles.flowTable}>
                <FlowTable query={query} elapsed={elapsedProp}/>
            </div>
        </div>
    );
}

interface VisualizerProps {
  query: string;
  elapsed: {};
}

