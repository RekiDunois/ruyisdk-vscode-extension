import { spawn, SpawnOptionsWithoutStdio } from 'child_process';

export async function runCommand(command: string, args: string[], option?: SpawnOptionsWithoutStdio): Promise<string>
{
    const result = spawn(command, args, option)
    return new Promise((resolve, rejects) => {
        let stdout = '';
        let stderr = '';
        let error = false;
        result.stdout.on('data', (data) => {
            stdout += data;
        });
        result.stderr.on('data', (data) => {
            stderr += data;
            error = true;
        });
        result.on('close', (_) => {
            if (error) {
                console.log(stderr.trim());
                resolve(stderr.trim()); // don't reject
            }
            resolve(stdout.trim());
        })
    })
};