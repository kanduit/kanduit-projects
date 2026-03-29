/**
 * Filters module: Manages filter state and applies combined filters.
 */
const BridgeFilters = (() => {
    let filterState = {
        roadClass: '',
        conditionMin: 0,
        decade: '',
        riskMin: 0,
    };

    let onFilterChange = null;

    function init(callback) {
        onFilterChange = callback;

        const elRoadClass = document.getElementById('filter-road-class');
        const elCondition = document.getElementById('filter-condition-min');
        const elDecade = document.getElementById('filter-decade');
        const elRiskMin = document.getElementById('filter-risk-min');
        const elRiskValue = document.getElementById('filter-risk-min-value');
        const elReset = document.getElementById('filter-reset');

        elRoadClass.addEventListener('change', () => {
            filterState.roadClass = elRoadClass.value;
            apply();
        });

        elCondition.addEventListener('change', () => {
            filterState.conditionMin = parseFloat(elCondition.value) || 0;
            apply();
        });

        elDecade.addEventListener('change', () => {
            filterState.decade = elDecade.value;
            apply();
        });

        elRiskMin.addEventListener('input', () => {
            filterState.riskMin = parseFloat(elRiskMin.value);
            elRiskValue.textContent = filterState.riskMin.toFixed(2);
            apply();
        });

        elReset.addEventListener('click', () => {
            filterState = { roadClass: '', conditionMin: 0, decade: '', riskMin: 0 };
            elRoadClass.value = '';
            elCondition.value = '0';
            elDecade.value = '';
            elRiskMin.value = '0';
            elRiskValue.textContent = '0.00';
            apply();
        });
    }

    function matchesFilter(props) {
        if (filterState.roadClass && props.strassenklasse !== filterState.roadClass) return false;
        if (filterState.conditionMin && props.zustandsnote < filterState.conditionMin) return false;
        if (filterState.riskMin && props.risiko_score < filterState.riskMin) return false;

        if (filterState.decade) {
            const decadeStart = parseInt(filterState.decade);
            if (decadeStart === 1920) {
                if (props.baujahr >= 1950) return false;
            } else {
                if (props.baujahr < decadeStart || props.baujahr >= decadeStart + 10) return false;
            }
        }

        return true;
    }

    function apply() {
        if (onFilterChange) {
            onFilterChange(matchesFilter);
        }
    }

    function getFilterFn() {
        return matchesFilter;
    }

    return { init, getFilterFn };
})();
