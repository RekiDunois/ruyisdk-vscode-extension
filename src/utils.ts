import { spawn } from 'child_process';

export async function runCommand(args: string[], workdir?: string): Promise<string[]> {
    const command = process.platform === 'linux' ? 'ruyi' : 'ruyi';
    console.log('run ruyi with arg: ', args)
	const ruyi = spawn(command, ['--porcelain', ...args], {
        cwd: workdir,
    });
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let error = false;
        ruyi.stdout.on('data', (data) => {
            stdout += data;
        });
        ruyi.stderr.on('data', (data) => {
            stderr += data;
            error = true;
        });
        ruyi.on('close', (_) => {
            if (error) {
                console.log(stderr.trim());
                resolve(stderr.trim().split('\n')); // don't reject
            }
            const output = stdout.trim().split('\n');
            output.forEach((value) => {
                try {
                    console.log(JSON.parse(value))
                } catch (error) {
                    console.log(value)
                }
            })
            resolve(output);
        });
    });
}