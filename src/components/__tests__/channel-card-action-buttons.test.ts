import { describe, expect, it } from 'vitest'

import actionButtonsSource from '../ChannelCardActionButtons.tsx?raw'

describe('ChannelCardActionButtons', () => {
  it('keeps the shared card action contract for toggling, pairing, diagnostics, repair, and removal', () => {
    expect(actionButtonsSource).toContain("import type { MouseEvent } from 'react'")
    expect(actionButtonsSource).toContain('showRepairAction: boolean')
    expect(actionButtonsSource).toContain('repairDisabled: boolean')
    expect(actionButtonsSource).toContain('repairingRepairAction: boolean')
    expect(actionButtonsSource).toContain('onOpenModelConfig?: (() => void) | null')
    expect(actionButtonsSource).toContain('onToggleEnabled: () => void')
    expect(actionButtonsSource).toContain('onOpenPairing: () => void')
    expect(actionButtonsSource).toContain('onOpenDiagnostics: () => void')
    expect(actionButtonsSource).toContain('onRepairPlugin: () => void')
    expect(actionButtonsSource).toContain('onRemove: () => void')
  })

  it('renders one shared button row and stops card clicks before dispatching the action handlers', () => {
    expect(actionButtonsSource).toContain('function handleCardActionClick(')
    expect(actionButtonsSource).toContain('event.stopPropagation()')
    expect(actionButtonsSource).toContain('<Group gap="xs">')
    expect(actionButtonsSource).toContain('Repair Feishu plugin')
    expect(actionButtonsSource).toContain('onClick={(event) => handleCardActionClick(event, onToggleEnabled)}')
    expect(actionButtonsSource).toContain('onClick={(event) => handleCardActionClick(event, onOpenPairing)}')
    expect(actionButtonsSource).toContain('onClick={(event) => handleCardActionClick(event, onOpenDiagnostics)}')
    expect(actionButtonsSource).toContain('onClick={(event) => handleCardActionClick(event, onRepairPlugin)}')
    expect(actionButtonsSource).toContain('onClick={(event) => handleCardActionClick(event, onRemove)}')
  })
})
