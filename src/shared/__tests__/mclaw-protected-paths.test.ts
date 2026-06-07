import { describe, expect, it } from 'vitest'
import { isLikelyMclawInternalPath } from '../mclaw-protected-paths'

describe('isLikelyMclawInternalPath', () => {
  it('matches user-data state files inside the Mclaw roaming directory', () => {
    expect(
      isLikelyMclawInternalPath(
        'C:\\Users\\James\\AppData\\Roaming\\Mclaw\\openclaw-state\\openclaw.json'
      )
    ).toBe(true)
  })

  it('matches packaged runtime roots even when the path points to the root directory itself', () => {
    expect(
      isLikelyMclawInternalPath('C:\\Program Files\\Mclaw\\resources\\openclaw-bundle')
    ).toBe(true)
    expect(
      isLikelyMclawInternalPath('C:\\Program Files\\Mclaw\\resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd')
    ).toBe(true)
  })

  it('matches explicit protected roots passed in from the caller', () => {
    expect(
      isLikelyMclawInternalPath('D:\\custom-user-data\\runtime\\logs\\latest.log', {
        protectedRoots: ['D:\\custom-user-data'],
      })
    ).toBe(true)
  })

  it('does not treat normal user files as internal Mclaw paths, but still protects nested .openclaw state', () => {
    expect(
      isLikelyMclawInternalPath('C:\\Users\\James\\Desktop\\AI试衣间开发文档.md')
    ).toBe(false)
    expect(
      isLikelyMclawInternalPath('D:\\workspace\\my-app\\.openclaw\\notes-for-project.md')
    ).toBe(true)
  })
})
