import typescript from '@rollup/plugin-typescript'
import { terser } from 'rollup-plugin-terser'
import resolve from 'rollup-plugin-node-resolve'

export default [
  {
    input: 'src/server.ts',
    output: [
      {
        file: 'server.js',
        format: 'cjs'
      }
    ],
    plugins: [
      resolve(),
      typescript(),
    ]
  },
  {
    input: 'src/client.ts',
    output: [
      {
        file: 'client.js',
        format: 'esm'
      },
      {
        file: 'client.umd.js',
        name: 'RCM',
        format: 'umd'
      },
    ],
    plugins: [
      resolve(),
      typescript(),
      terser({
        include: ['*umd*'],
      })
    ]
  }
]