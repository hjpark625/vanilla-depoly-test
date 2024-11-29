import { resolve } from 'path'
import dotenv from 'dotenv'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import CopyWebpackPlugin from 'copy-webpack-plugin'
import { CleanWebpackPlugin } from 'clean-webpack-plugin'
import TerserPlugin from 'terser-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import Dotenv from 'dotenv-webpack'
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin'
import 'webpack-dev-server'

const __dirname = resolve()

function recursiveIssuer(m) {
  if (m.issuer) {
    return recursiveIssuer(m.issuer)
  } else if (m.name) {
    return m.name
  }
  return false
}

export default function (env, args) {
  const { parsed: environments } = dotenv.config({ path: './.env' })

  const isProduction = args.mode === 'production'

  return {
    mode: args.mode || 'development', // development 또는 production 설정
    entry: {
      home: ['babel-polyfill', './src/pages/home/main.js'],
      map: ['babel-polyfill', './src/pages/map/main.js'],
      'sharedparkinglot-map': ['babel-polyfill', './src/pages/sharedparkinglot-map/main.js']
    },
    resolve: {
      mainFields: ['browser', 'module', 'main'],
      extensions: ['.js', '.json', '.mjs'],
      // 브라우저에서 사용되는 Node.js 전역 변수를 polyfill로 대체
      fallback: {
        util: 'util/',
        path: 'path-browserify',
        os: 'os-browserify/browser',
        crypto: 'crypto-browserify',
        buffer: 'buffer/',
        stream: 'stream-browserify',
        vm: 'vm-browserify',
        process: 'process/browser'
      }
    },
    output: {
      path: resolve(__dirname, 'dist'),
      filename: '[name]/[contenthash:8].js', // 각 페이지에 대해 별도 번들 생성
      chunkFilename: '[name]/[contenthash:8].js',
      publicPath: '/',
      clean: true // dist 폴더를 매번 정리,
    },
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
    plugins: [
      new NodePolyfillPlugin(),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser'
      }),
      new Dotenv({
        path: './.env',
        safe: false
      }),
      new CleanWebpackPlugin(),
      // Home 페이지
      new HtmlWebpackPlugin({
        filename: 'index.html', // 번들링된 HTML 파일 경로
        template: './src/pages/home/index.html', // 원본 HTML 파일
        chunks: ['home'], // 해당 HTML에 포함할 번들
        templateParameters: {
          STORAGE_URL: environments.storageUrl || '',
          NAVER_KEY: environments.naverKey || ''
        }
      }),
      // Map 페이지
      new HtmlWebpackPlugin({
        filename: 'map/index.html',
        template: './src/pages/map/index.html',
        chunks: ['map'],
        templateParameters: {
          STORAGE_URL: environments.storageUrl || '',
          NAVER_KEY: environments.naverKey || ''
        }
      }),
      // PartnerMap 페이지
      new HtmlWebpackPlugin({
        filename: 'sharedparkinglot-map/index.html',
        template: './src/pages/sharedparkinglot-map/index.html',
        chunks: ['sharedparkinglot-map'],
        templateParameters: {
          STORAGE_URL: environments.storageUrl || '',
          NAVER_KEY: environments.naverKey || ''
        }
      }),
      // Static 파일 복사
      new CopyWebpackPlugin({
        patterns: [
          {
            from: resolve(__dirname, 'public'),
            to: '',
            noErrorOnMissing: true
          }
        ]
      }),
      isProduction && new MiniCssExtractPlugin({ filename: '[name]/[contenthash:8].css' })
    ].filter(Boolean),
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction
            },
            output: {
              comments: !isProduction
            }
          }
        })
      ],
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        automaticNameDelimiter: '~',
        cacheGroups: {
          mapStyles: {
            name: 'map',
            test: (m, c, entry) => m.constructor.name === 'CssModule' && recursiveIssuer(m) === entry,
            chunks: 'all',
            enforce: true
          },
          sharedparkinglotMapStyles: {
            name: 'sharedparkinglot-map',
            test: (m, c, entry) => m.constructor.name === 'CssModule' && recursiveIssuer(m) === entry,
            chunks: 'all',
            enforce: true
          },
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true
          }
        }
      }
    },
    devServer: {
      static: {
        directory: resolve(__dirname, 'public'),
        publicPath: '/'
      },
      port: 4201,
      open: false, // 브라우저 자동 열기
      hot: true,
      proxy: [
        {
          context: ['/proxy/'],
          target: 'https://parkyapi-dev.modudev.cloud/',
          changeOrigin: true,
          secure: false,
          pathRewrite: { '^/proxy': '' }
        }
      ]
    },
    module: {
      rules: [
        {
          test: /\.m?js$/i,
          resolve: {
            fullySpecified: false
          }
        },
        {
          test: /\.(js|mjs|cjs)$/i,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              configFile: resolve(__dirname, '.babelrc')
            }
          }
        },
        {
          test: /\.css$/i, // CSS 파일 처리
          use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader']
        },
        {
          test: /\.less$/i, // Less 파일 처리
          use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader', 'less-loader']
        },
        {
          test: /\.svg$/i, // svg 처리
          use: ['@svgr/webpack']
        },
        {
          test: /\.(png|jpe?g|gif)$/i,
          use: [
            {
              loader: 'url-loader',
              options: {
                limit: 8192,
                name: 'assets/images/[name].[contenthash:8].[ext]'
              }
            }
          ]
        }
      ]
    }
  }
}
