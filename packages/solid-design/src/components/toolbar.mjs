import styles from '../toolbar.css' with { type: 'text' };

export const muzeSolidDesignToolbar = {
  styles: { 'muze-solid-design-toolbar': styles },
  actions: {
    // Geometry only: the owning feature binds these attributes with SimplyFlow.
    // Stay within this document's visual viewport, including phone keyboards.
    muzeSolidDesignToolbarPlacement(toolbar, anchor) {
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0;
      const top = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth;
      const height = viewport?.height || innerHeight;
      const size = toolbar.getBoundingClientRect();
      const x = Math.max(
        left + 8,
        Math.min(anchor.left, left + width - size.width - 8)
      );
      const below = anchor.bottom + 8;
      const y = Math.max(
        top + 8,
        Math.min(
          below + size.height <= top + height - 8
            ? below
            : anchor.top - size.height - 8,
          top + height - size.height - 8
        )
      );
      return 'left:' + x + 'px;top:' + y + 'px;';
    }
  }
};
