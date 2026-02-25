import { useEffect, useState, useCallback } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { useLifeInventory } from '../hooks/useLifeInventory';
import { useHelmContext } from '../contexts/HelmContext';
import type { LifeInventoryArea } from '../lib/types';
import { FloatingActionButton, LoadingSpinner, Button, Input, FeatureGuide } from '../components/shared';
import { FEATURE_GUIDES } from '../lib/featureGuides';
import { AreaCard } from '../components/lifeinventory/AreaCard';
import './LifeInventory.css';

export default function LifeInventory() {
  usePageContext({ page: 'lifeinventory' });
  const { startGuidedConversation } = useHelmContext();

  const {
    areas,
    loading,
    error,
    fetchAreas,
    createArea,
    updateArea,
    deleteArea,
  } = useLifeInventory();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const handleAssessAtHelm = useCallback(async () => {
    await startGuidedConversation('life_inventory');
  }, [startGuidedConversation]);

  const handleDiscussArea = useCallback(async (area: LifeInventoryArea) => {
    await startGuidedConversation('life_inventory', undefined, area.id);
  }, [startGuidedConversation]);

  const handleAddArea = useCallback(async () => {
    if (!newAreaName.trim()) return;
    await createArea(newAreaName.trim());
    setNewAreaName('');
    setShowAddForm(false);
  }, [createArea, newAreaName]);

  return (
    <div className="page life-inventory-page">
      <div className="life-inventory-page__header">
        <h1 className="life-inventory-page__title">Life Inventory</h1>
        <p className="life-inventory-page__subtitle">
          An honest look at where you are — and where you want to be.
        </p>
      </div>

      <FeatureGuide {...FEATURE_GUIDES.lifeinventory} />

      {loading && areas.length === 0 ? (
        <div className="life-inventory-page__loading">
          <LoadingSpinner size="md" />
        </div>
      ) : (
        <>
          {error && (
            <p className="life-inventory-page__error">{error}</p>
          )}

          <div className="life-inventory-page__column-headers">
            <span />
            <span>Where I Was</span>
            <span>Where I Am</span>
            <span>Where I Want to Be</span>
          </div>

          <div className="life-inventory-page__areas">
            {areas.map((area) => (
              <AreaCard
                key={area.id}
                area={area}
                onUpdate={updateArea}
                onDelete={deleteArea}
                onDiscussAtHelm={handleDiscussArea}
              />
            ))}
          </div>

          {showAddForm ? (
            <div className="life-inventory-page__add-form">
              <Input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="Area name..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddArea();
                  if (e.key === 'Escape') setShowAddForm(false);
                }}
                autoFocus
              />
              <div className="life-inventory-page__add-actions">
                <Button size="sm" onClick={handleAddArea} disabled={!newAreaName.trim()}>
                  Add
                </Button>
                <Button size="sm" variant="text" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="life-inventory-page__add-btn"
              onClick={() => setShowAddForm(true)}
            >
              + Add Custom Area
            </button>
          )}
        </>
      )}

      <FloatingActionButton onClick={handleAssessAtHelm} aria-label="Assess at The Helm">
        +
      </FloatingActionButton>
    </div>
  );
}
