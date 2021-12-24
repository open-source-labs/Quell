export interface RedisInfo {
    redisStats?:  RedisStats;
    redisKeys?:   string[];
    redisValues?: string[];
}

export interface RedisStats {
    server: Stat[];
    client: Stat[];
    memory: Stat[];
    stats:  Stat[];
    [key: string]: Stat[];
}

export interface Stat {
    name:  string;
    value: string;
}
