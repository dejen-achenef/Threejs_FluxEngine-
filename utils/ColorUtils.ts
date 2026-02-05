import * as THREE from 'three';

/**
 * Helper utilities for working with colors in the PCB engine.
 */
export class ColorUtils {
    /**
     * Converts a hex number color to a CSS-friendly string.
     */
    public static hexToCss(hex: number): string {
        return `#${hex.toString(16).padStart(6, '0')}`;
    }

    /**
     * Darkens or lightens a color by a percentage.
     * @param color The base color
     * @param amount Negative to darken, positive to lighten (-1 to 1)
     */
    public static shiftColor(color: number, amount: number): number {
        const threeColor = new THREE.Color(color);
        if (amount < 0) {
            threeColor.lerp(new THREE.Color(0x000000), Math.abs(amount));
        } else {
            threeColor.lerp(new THREE.Color(0xffffff), amount);
        }
        return threeColor.getHex();
    }
}
