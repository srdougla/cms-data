// Get references to HTML elements
const tableSelect = document.getElementById('tableSelect');
const viewAllBtn = document.getElementById('viewAllBtn');
const viewPreviewBtn = document.getElementById('viewPreviewBtn');
const viewInfoBtn = document.getElementById('viewInfoBtn');
const queryBtn = document.getElementById('queryBtn');
const loading = document.getElementById('loading');
const tableContainer = document.getElementById('tableContainer');
const errorContainer = document.getElementById('errorContainer');
const joinBtn = document.getElementById('joinBtn');
joinBtn.disabled = false;

// Track current view
let currentView = null;  // Will be 'all', 'preview', or 'info'
let currentTableName = null;

// Function to show/hide loading state 
function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
    viewAllBtn.disabled = show;
    viewPreviewBtn.disabled = show;
    viewInfoBtn.disabled = show;
}

// Function to show error message
function showError(message) {
    errorContainer.innerHTML = `
        <div class="error">❌ ${message}</div>
    `;
    setTimeout(() => {
        errorContainer.innerHTML = '';
    }, 5000);
}

// Function to clear error message
function clearError() {
    errorContainer.innerHTML = '';
}

// Function to format table names nicely
function formatTableName(tableName) {
    return tableName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Search functionality
function setupTableSearch() {
    const searchBox = document.getElementById('searchBox');
    const searchContainer = document.getElementById('searchContainer');
    const searchResults = document.getElementById('searchResults');

    searchBox.value = '';

    searchContainer.style.display = 'flex';

    searchBox.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const table = tableContainer.querySelector('table');

        if (!table) return;

        const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
        let visibleCount = 0;
        let totalCount = rows.length;

        // if search empty, show all rows
        if (searchTerm === '') {
            rows.forEach(row => {
                row.classList.remove('hidden');
                row.classList.ass('visible');
            });
            searchResults.textContent = `Showing all ${totalCount} rows`;
            return;
        }

        // filter based on search inputted
        rows.forEach(row => {
            if (row.querySelector('th')) return;

            const text = row.textContent.toLowerCase();

            if (text.includes(searchTerm)) {
                row.classList.remove('hidden');
                row.classList.add('visible');
                visibleCount++;
            } else {
                row.classList.add('hidden');
                row.classList.remove('visible');
            }
        });
        // update results count
        searchResults.textContent = `Showing ${visibleCount} of ${totalCount} rows`;
    });
}

// Function to display table data
function displayTable(data, isPreview = false) {
    tableContainer.classList.remove('empty');
    
    if (!data.rows || data.rows.length === 0) {
        tableContainer.innerHTML = '<p class="empty">No data found in this table.</p>';
        tableContainer.classList.add('empty');
        return;
    }

    // Build HTML table
    let html = '<table>';
    
    // Header row (don't show ROWID column to users)
    html += '<tr>';
    data.columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '<th>Actions</th>';
    html += '</tr>';
    
    // Data rows
    data.rows.forEach(row => {
        const actualRowId = row.ROWID;  // Get the ACTUAL database ROWID
        
        html += '<tr>';
        data.columns.forEach(col => {
            const value = row[col] !== null && row[col] !== undefined ? row[col] : '<em style="color: #999;">NULL</em>';
            html += `<td>${value}</td>`;
        });
        // Add both Edit and Delete buttons
        html += `<td>
            <button class="edit-btn" data-table="${tableSelect.value}" data-row-id="${actualRowId}">Edit</button>
            <button class="delete-btn" data-table="${tableSelect.value}" data-row-id="${actualRowId}">Delete</button>
        </td>`;
        html += '</tr>';
    });
    
    html += '</table>';
    
    // Add row count info
    if (isPreview) {
        html += `<div class="row-count">Showing 20 of ${data.total_rows} total rows</div>`;
    } else {
        html += `<div class="row-count">Total rows: ${data.total_rows}</div>`;
    }
    
    tableContainer.innerHTML = html;

    // Attach event listeners to delete buttons
    const deleteButtons = tableContainer.querySelectorAll('.delete-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tableName = this.getAttribute('data-table');
            const rowId = parseInt(this.getAttribute('data-row-id'));
            deleteRow(tableName, rowId);
        });
    });

    // Attach event listeners to edit buttons
    const editButtons = tableContainer.querySelectorAll('.edit-btn');
    editButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tableName = this.getAttribute('data-table');
            const rowId = parseInt(this.getAttribute('data-row-id'));
            const rowElement = this.closest('tr');
            editRow(tableName, rowId, rowElement);
        });
    });

    setupTableSearch();
}

// Function to display table info
function displayTableInfo(info) {
    tableContainer.classList.remove('empty');

    // hide search box when this page is showing
    document.getElementById('searchContainer').style.display = 'none';
    
    let html = '<div class="table-info">';
    html += `<h3>📊 ${formatTableName(info.table_name)} - Database Schema</h3>`;
    html += `<p><strong>Total Records:</strong> ${info.row_count.toLocaleString()}</p>`;
    html += '<h4 style="margin-top: 20px; color: #333;">Columns:</h4>';
    html += '<div class="column-info">';
    
    info.columns.forEach(col => {
        const pkClass = col.primary_key ? 'primary-key' : '';
        const pkLabel = col.primary_key ? ' 🔑' : '';
        const nullLabel = col.nullable ? ' (nullable)' : ' (required)';
        
        html += `
            <div class="column-item ${pkClass}">
                <div class="column-name">${col.name}${pkLabel}</div>
                <div class="column-type">${col.type}${nullLabel}</div>
            </div>
        `;
    });
    
    html += '</div></div>';
    tableContainer.innerHTML = html;
}

// Handle delete row
async function deleteRow(tableName, rowId) {
    if (!confirm(`Are you sure you want to delete row ${rowId}? This cannot be undone.`)) {
        return;
    }

    clearError();
    showLoading(true);

    try {
        const response = await fetch(`/api/tables/${tableName}/rows/${rowId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete row');
        }

        const result = await response.json();

        if (result.success) {
            // Find and remove the row immediately
            const buttons = document.querySelectorAll('.delete-btn');
            buttons.forEach(btn => {
                if (parseInt(btn.getAttribute('data-row-id')) === rowId) {
                    btn.closest('tr').remove();
                }
            });
        }
    } catch (error) {
        showError('Error deleting row: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Handle edit row
async function editRow(tableName, rowId, rowElement) {
    // Get current values from the row
    const cells = rowElement.querySelectorAll('td');
    const currentValues = {};
    
    // Get column names from the table header
    const headers = tableContainer.querySelectorAll('th');
    const columnNames = [];
    
    // Skip the last header (Actions column)
    for (let i = 0; i < headers.length - 1; i++) {
        columnNames.push(headers[i].textContent);
    }
    
    // Get current values (skip the last cell which has buttons)
    for (let i = 0; i < cells.length - 1; i++) {
        const cellText = cells[i].textContent;
        // Handle NULL values
        currentValues[columnNames[i]] = cellText === 'NULL' ? '' : cellText;
    }
    
    // Create a modal/popup with form
    const modal = createEditModal(tableName, rowId, columnNames, currentValues);
    document.body.appendChild(modal);
    
    // Focus on first input
    const firstInput = modal.querySelector('input');
    if (firstInput) firstInput.focus();
}

// Create edit modal
function createEditModal(tableName, rowId, columnNames, currentValues) {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editModal';
    
    let html = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Row ${rowId}</h2>
                <button class="close-btn" onclick="closeEditModal()">&times;</button>
            </div>
            <form id="editForm">
    `;
    
    // Create input for each column
    columnNames.forEach(col => {
        const value = currentValues[col] || '';
        html += `
            <div class="form-group">
                <label for="edit_${col}">${col}:</label>
                <input type="text" id="edit_${col}" name="${col}" value="${value}">
            </div>
        `;
    });
    
    html += `
                <div class="form-actions">
                    <button type="button" class="cancel-btn" onclick="closeEditModal()">Cancel</button>
                    <button type="submit" class="save-btn">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    
    modal.innerHTML = html;
    
    // Add form submit handler
    const form = modal.querySelector('#editForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveRowChanges(tableName, rowId, columnNames);
    });
    
    return modal;
}

// Close modal function
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.remove();
    }
}

// Save row changes
async function saveRowChanges(tableName, rowId, columnNames) {
    clearError();
    
    // Get form values
    const formData = {};
    columnNames.forEach(col => {
        const input = document.getElementById(`edit_${col}`);
        if (input) {
            formData[col] = input.value;
        }
    });
    
    console.log('Saving changes:', formData);
    
    try {
        const response = await fetch(`/api/tables/${tableName}/rows/${rowId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update row');
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Close modal
            closeEditModal();
            
            // Refresh the table view
            if (currentView === 'all') {
                viewAllBtn.click();
            } else if (currentView === 'preview') {
                viewPreviewBtn.click();
            }
        }
    } catch (error) {
        showError('Error updating row: ' + error.message);
    }
}

// Load available tables when page loads
async function loadTables() {
    try {
        const response = await fetch('/api/tables');
        
        if (!response.ok) {
            throw new Error('Failed to load tables');
        }
        
        const tables = await response.json();
        
        // Populate dropdown with formatted names
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table;
            option.textContent = formatTableName(table);
            tableSelect.appendChild(option);
        });
    } catch (error) {
        showError('Failed to load tables: ' + error.message);
    }
}

// Handle table selection
tableSelect.addEventListener('change', function() {
    const isSelected = this.value !== '';
    viewAllBtn.disabled = !isSelected;
    viewPreviewBtn.disabled = !isSelected;
    viewInfoBtn.disabled = !isSelected;
    queryBtn.disabled = !isSelected;
    
    if (!isSelected) {
        tableContainer.classList.add('empty');
    }
});

// Handle "View All" button click
viewAllBtn.addEventListener('click', async function() {
    const tableName = tableSelect.value;
    if (!tableName) return;
    
    clearError();
    showLoading(true);
    
    try {
        const response = await fetch(`/api/tables/${tableName}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }
        
        const data = await response.json();
        displayTable(data, false);

        // track current view
        currentView = 'all';
        currentTableName = tableName;

    } catch (error) {
        showError('Error loading table: ' + error.message);
    } finally {
        showLoading(false);
    }
});

// Handle "View First 20 Rows" button click
viewPreviewBtn.addEventListener('click', async function() {
    const tableName = tableSelect.value;
    if (!tableName) return;
    
    clearError();
    showLoading(true);
    
    try {
        const response = await fetch(`/api/tables/${tableName}/preview`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch preview data');
        }
        
        const data = await response.json();
        displayTable(data, true);

        // track current view
        currentView = 'preview';
        currentTableName = tableName;

    } catch (error) {
        showError('Error loading preview: ' + error.message);
    } finally {
        showLoading(false);
    }
});

// Handle "Table Info" button click
viewInfoBtn.addEventListener('click', async function() {
    const tableName = tableSelect.value;
    if (!tableName) return;
    
    clearError();
    showLoading(true);
    
    try {
        const response = await fetch(`/api/tables/${tableName}/info`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch table info');
        }
        
        const info = await response.json();
        displayTableInfo(info);

        // track current view
        currentView = 'info';  // FIXED: was 'preview'
        currentTableName = tableName;

    } catch (error) {
        showError('Error loading table info: ' + error.message);
    } finally {
        showLoading(false);
    }
});

// QUERY BUILDER FUNCTIONS!!! ------------------------------------------------------------
function openQueryBuilder(tableName) {
    // get column info for table
    fetch(`/api/tables/${tableName}/info`)
    .then(response => response.json())
    .then(info => {
        const modal = createQueryBuilderModal(tableName, info.columns);
        document.body.appendChild(modal);
    })
    .catch(error => {
        showError('Error loading table info: ' + error.message);
    });
}

function createQueryBuilderModal(tableName, columns) {
    const modal = document.createElement('div');
    modal.className = 'query-modal';
    modal.id = 'queryModal';

    // get column names
    const columnNames = columns.map(col => col.name);

    let html = `
        <div class="query-modal-content">
            <div class="query-modal-header">
                <h2>🔍 Query Builder - ${formatTableName(tableName)}</h2>
                <button class="close-btn" onclick="closeQueryBuilder()">&times;</button>
            </div>
            
            <!-- SELECT Section -->
            <div class="query-section">
                <h3>1. SELECT - What to retrieve</h3>
                <p class="query-section-description">Choose what data you want to see</p>
                
                <div class="query-option">
                    <label>
                        <input type="radio" name="selectType" value="columns" checked>
                        Specific columns
                    </label>
                    <select id="selectColumns" multiple size="5" style="margin-top: 10px;">
                        ${columnNames.map(col => `<option value="${col}">${col}</option>`).join('')}
                    </select>
                    <small style="color: #666;">Hold Ctrl (Cmd on Mac) to select multiple</small>
                </div>
                
                <div class="query-option" style="margin-top: 15px;">
                    <label>
                        <input type="radio" name="selectType" value="all">
                        All columns (*)
                    </label>
                </div>
                
                <div class="query-option" style="margin-top: 15px;">
                    <label>
                        <input type="radio" name="selectType" value="aggregate">
                        Aggregate function
                    </label>
                    <div id="aggregateOptions" style="display: none; margin-top: 10px;">
                        <select id="aggregateFunction">
                            <option value="COUNT">COUNT</option>
                            <option value="SUM">SUM</option>
                            <option value="AVG">AVG</option>
                            <option value="MIN">MIN</option>
                            <option value="MAX">MAX</option>
                        </select>
                        <select id="aggregateColumn" style="margin-top: 10px;">
                            <option value="*">* (all rows)</option>
                            ${columnNames.map(col => `<option value="${col}">${col}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- WHERE Section -->
            <div class="query-section">
                <h3>2. WHERE - Filter results (optional)</h3>
                <p class="query-section-description">Add conditions to filter your data</p>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="useWhere">
                    <label for="useWhere">Add WHERE conditions</label>
                </div>
                
                <div id="whereConditions" style="display: none; margin-top: 15px;">
                    <!-- WHERE conditions will be added here dynamically -->
                </div>
            </div>
            
            <!-- ORDER BY Section -->
            <div class="query-section">
                <h3>3. ORDER BY - Sort results (optional)</h3>
                <p class="query-section-description">Sort your results by a column</p>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="useOrderBy">
                    <label for="useOrderBy">Add ORDER BY</label>
                </div>
                
                <div id="orderByOptions" style="display: none; margin-top: 15px;">
                    <select id="orderByColumn">
                        ${columnNames.map(col => `<option value="${col}">${col}</option>`).join('')}
                    </select>
                    <select id="orderByDirection" style="margin-top: 10px;">
                        <option value="ASC">Ascending (A-Z, 0-9)</option>
                        <option value="DESC">Descending (Z-A, 9-0)</option>
                    </select>
                </div>
            </div>
            
            <!-- LIMIT Section -->
            <div class="query-section">
                <h3>4. LIMIT - Limit results (optional)</h3>
                <p class="query-section-description">Limit the number of rows returned</p>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="useLimit">
                    <label for="useLimit">Add LIMIT</label>
                </div>
                
                <div id="limitOptions" style="display: none; margin-top: 15px;">
                    <input type="number" id="limitValue" min="1" value="100" placeholder="Number of rows">
                </div>
            </div>
            
            <!-- Query Preview -->
            <div class="query-section">
                <h3>Query Preview</h3>
                <div class="query-preview" id="queryPreview">
                    SELECT * FROM ${tableName}
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="query-actions">
                <button class="cancel-btn" onclick="closeQueryBuilder()">Cancel</button>
                <button class="execute-query-btn" onclick="executeQuery('${tableName}')">Execute Query</button>
            </div>
        </div>
    `;

    modal.innerHTML = html;

    // event listeners
    setTimeout(() => setupQueryBuilderListeners(tableName, columnNames), 0);

    return modal;
}

// Update query preview
// Update query preview
function updateQueryPreview(tableName, columnNames) {
    const preview = document.getElementById('queryPreview');
    if (!preview) return;
    
    let query = 'SELECT ';
    
    // SELECT clause
    const selectType = document.querySelector('input[name="selectType"]:checked').value;
    
    if (selectType === 'all') {
        query += '*';
    } else if (selectType === 'columns') {
        const selectedColumns = Array.from(document.getElementById('selectColumns').selectedOptions)
            .map(opt => opt.value);
        query += selectedColumns.length > 0 ? selectedColumns.join(', ') : '*';
    } else if (selectType === 'aggregate') {
        const func = document.getElementById('aggregateFunction').value;
        const col = document.getElementById('aggregateColumn').value;
        query += `${func}(${col})`;
    }
    
    query += ` FROM ${tableName}`;
    
    // WHERE clause
    const useWhere = document.getElementById('useWhere').checked;
    if (useWhere) {
        const conditions = [];
        const connectors = [];
        
        document.querySelectorAll('.where-condition').forEach((condDiv, idx) => {
            const column = condDiv.querySelector('.where-column').value;
            const operator = condDiv.querySelector('.where-operator').value;
            
            let value;
            let conditionStr;
            
            if (operator === 'BETWEEN') {
                const lowerInput = condDiv.querySelector('.between-lower');
                const upperInput = condDiv.querySelector('.between-upper');
                if (lowerInput && upperInput) {
                    const lower = lowerInput.value;
                    const upper = upperInput.value;
                    if (lower && upper) {
                        const quotedLower = isNaN(lower) ? `'${lower}'` : lower;
                        const quotedUpper = isNaN(upper) ? `'${upper}'` : upper;
                        conditionStr = `${column} BETWEEN ${quotedLower} AND ${quotedUpper}`;
                    }
                }
            } else if (operator === 'IN') {
                const inInput = condDiv.querySelector('.in-values');
                if (inInput && inInput.value) {
                    const values = inInput.value.split(',').map(v => v.trim()).filter(v => v);
                    if (values.length > 0) {
                        const quotedValues = values.map(v => isNaN(v) ? `'${v}'` : v).join(', ');
                        conditionStr = `${column} IN (${quotedValues})`;
                    }
                }
            } else if (operator === 'LIKE') {
                value = condDiv.querySelector('.where-value').value;
                if (value) {
                    // Show how LIKE will actually work in the query
                    conditionStr = `${column} LIKE '%${value}%'`;
                }
            } else {
                value = condDiv.querySelector('.where-value').value;
                
                if (value) {
                    const quotedValue = isNaN(value) ? `'${value}'` : value;
                    conditionStr = `${column} ${operator} ${quotedValue}`;
                }
            }
            
            if (conditionStr) {
                conditions.push(conditionStr);
                
                // Get connector (AND/OR) if not the first condition
                if (idx > 0) {
                    const connectorSelect = condDiv.querySelector('.where-connector');
                    if (connectorSelect) {
                        connectors.push(connectorSelect.value);
                    }
                }
            }
        });
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions[0];
            for (let i = 1; i < conditions.length; i++) {
                const connector = connectors[i - 1] || 'AND';
                query += ` ${connector} ${conditions[i]}`;
            }
        }
    }
    
    // ORDER BY clause
    const useOrderBy = document.getElementById('useOrderBy').checked;
    if (useOrderBy) {
        const column = document.getElementById('orderByColumn').value;
        const direction = document.getElementById('orderByDirection').value;
        query += ` ORDER BY ${column} ${direction}`;
    }
    
    // LIMIT clause
    const useLimit = document.getElementById('useLimit').checked;
    if (useLimit) {
        const limitValue = document.getElementById('limitValue').value;
        if (limitValue) {
            query += ` LIMIT ${limitValue}`;
        }
    }
    
    query += ';';
    
    preview.textContent = query;
}

function setupQueryBuilderListeners(tableName, columnNames) {
    // SELECT buttons
    const selectTypeRadios = document.querySelectorAll('input[name="selectType"]');
    const aggregateOptions = document.getElementById('aggregateOptions');

    selectTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            // show/hide aggregate functions
            aggregateOptions.style.display = this.value === 'aggregate' ? 'block' : 'none';
            updateQueryPreview(tableName, columnNames);
        });
    });

    // change selected columns
    document.getElementById('selectColumns').addEventListener('change', function() {
        updateQueryPreview(tableName, columnNames);
    });

    // agg function/column change
    document.getElementById('aggregateFunction').addEventListener('change', function() {
        updateQueryPreview(tableName, columnNames);
    });
    document.getElementById('aggregateColumn').addEventListener('change', function() {
        updateQueryPreview(tableName, columnNames);
    });

    // WHERE 
    const useWhereCheckbox = document.getElementById('useWhere');
    const whereConditions = document.getElementById('whereConditions');

    useWhereCheckbox.addEventListener('change', function() {
        whereConditions.style.display = this.checked ? 'block' : 'none';
        if (this.checked && whereConditions.children.length === 0) {
            addWhereCondition(tableName, columnNames);
        }
        updateQueryPreview(tableName, columnNames);
    });

    // ORDER BY
    const useOrderByCheckbox = document.getElementById('useOrderBy');
    const orderByOptions = document.getElementById('orderByOptions');
    
    useOrderByCheckbox.addEventListener('change', function() {
        orderByOptions.style.display = this.checked ? 'block' : 'none';
        updateQueryPreview(tableName, columnNames);
    });
    
    document.getElementById('orderByColumn').addEventListener('change', function() {
        updateQueryPreview(tableName, columnNames);
    });
    document.getElementById('orderByDirection').addEventListener('change', function() {
        updateQueryPreview(tableName, columnNames);
    });

    // LIMIT
    const useLimitCheckbox = document.getElementById('useLimit');
    const limitOptions = document.getElementById('limitOptions');
    
    useLimitCheckbox.addEventListener('change', function() {
        limitOptions.style.display = this.checked ? 'block' : 'none';
        updateQueryPreview(tableName, columnNames);
    });
    
    document.getElementById('limitValue').addEventListener('input', function() {
        updateQueryPreview(tableName, columnNames);
    });

    // update query preview for user
    updateQueryPreview(tableName, columnNames);
}

// Add a WHERE condition
function addWhereCondition(tableName, columnNames) {
    const whereConditions = document.getElementById('whereConditions');
    const conditionIndex = whereConditions.children.length;
    
    const conditionDiv = document.createElement('div');
    conditionDiv.className = 'where-condition';
    conditionDiv.id = `whereCondition${conditionIndex}`;
    
    conditionDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>Condition ${conditionIndex + 1}</strong>
            ${conditionIndex > 0 ? `<button class="remove-condition-btn" onclick="removeWhereCondition(${conditionIndex}, '${tableName}', ${JSON.stringify(columnNames).replace(/"/g, '&quot;')})">Remove</button>` : ''}
        </div>
        ${conditionIndex > 0 ? `
        <div style="margin: 10px 0;">
            <select class="where-connector" data-index="${conditionIndex}">
                <option value="AND">AND</option>
                <option value="OR">OR</option>
            </select>
        </div>
        ` : ''}
        <div class="where-inputs">
            <select class="where-column" data-index="${conditionIndex}">
                ${columnNames.map(col => `<option value="${col}">${col}</option>`).join('')}
            </select>
            <select class="where-operator" data-index="${conditionIndex}">
                <option value="=">=</option>
                <option value="!=">!=</option>
                <option value="<"><</option>
                <option value=">">></option>
                <option value="<="><=</option>
                <option value=">=">>=</option>
                <option value="LIKE">LIKE</option>
                <option value="IN">IN</option>
                <option value="BETWEEN">BETWEEN</option>
            </select>
            <div class="where-value-container" data-index="${conditionIndex}">
                <input type="text" class="where-value" data-index="${conditionIndex}" placeholder="Value">
                <small class="input-hint" style="display: none; color: #666; font-size: 0.85em; margin-top: 5px;"></small>
            </div>
        </div>
        <div class="between-inputs" data-index="${conditionIndex}" style="display: none; margin-top: 10px;">
            <input type="text" class="between-lower" data-index="${conditionIndex}" placeholder="Lower value">
            <span style="margin: 0 10px;">AND</span>
            <input type="text" class="between-upper" data-index="${conditionIndex}" placeholder="Upper value">
        </div>
        <div class="in-inputs" data-index="${conditionIndex}" style="display: none; margin-top: 10px;">
            <input type="text" class="in-values" data-index="${conditionIndex}" placeholder="Enter values separated by commas">
            <small style="display: block; color: #666; font-size: 0.85em; margin-top: 5px;">
                💡 Example: value1, value2, value3 or 10, 20, 30
            </small>
        </div>
    `;
    
    whereConditions.appendChild(conditionDiv);
    
    // Add event listener for operator change to show/hide different inputs
    const operatorSelect = conditionDiv.querySelector('.where-operator');
    const whereValueContainer = conditionDiv.querySelector('.where-value-container');
    const whereValueInput = conditionDiv.querySelector('.where-value');
    const inputHint = conditionDiv.querySelector('.input-hint');
    const betweenInputs = conditionDiv.querySelector('.between-inputs');
    const inInputs = conditionDiv.querySelector('.in-inputs');
    
    operatorSelect.addEventListener('change', function() {
        // Hide all special input sections first
        whereValueContainer.style.display = 'none';
        betweenInputs.style.display = 'none';
        inInputs.style.display = 'none';
        inputHint.style.display = 'none';
        
        if (this.value === 'BETWEEN') {
            betweenInputs.style.display = 'flex';
            betweenInputs.style.alignItems = 'center';
            betweenInputs.style.gap = '10px';
        } else if (this.value === 'IN') {
            inInputs.style.display = 'block';
        } else if (this.value === 'LIKE') {
            whereValueContainer.style.display = 'block';
            whereValueInput.placeholder = 'Search pattern';
            inputHint.textContent = '💡 Tip: Use % as wildcard (e.g., %boston% finds "Boston Medical Center")';
            inputHint.style.display = 'block';
        } else {
            whereValueContainer.style.display = 'block';
            whereValueInput.placeholder = 'Value';
            inputHint.style.display = 'none';
        }
        updateQueryPreview(tableName, columnNames);
    });
    
    // Add event listeners for all inputs
    conditionDiv.querySelectorAll('select, input').forEach(element => {
        element.addEventListener('change', function() {
            updateQueryPreview(tableName, columnNames);
        });
        element.addEventListener('input', function() {
            updateQueryPreview(tableName, columnNames);
        });
    });
    
    // Add "Add Another" button if this is the first or we just added one
    if (!document.getElementById('addWhereBtn')) {
        const addBtn = document.createElement('button');
        addBtn.id = 'addWhereBtn';
        addBtn.className = 'add-condition-btn';
        addBtn.textContent = '+ Add Another Condition';
        addBtn.onclick = function() {
            addWhereCondition(tableName, columnNames);
        };
        whereConditions.appendChild(addBtn);
    }
    
    updateQueryPreview(tableName, columnNames);
}

// remove WHERE condition
function removeWhereCondition(index, tableName, columnNames) {
    const condition = document.getElementById(`whereCondition${index}`);
    if (condition) {
        condition.remove();
    }
    updateQueryPreview(tableName, columnNames);
}

function closeQueryBuilder() {
    const modal = document.getElementById('queryModal');
    if (modal) {
        modal.remove();
    }
}

// execute query!!
async function executeQuery(tableName) {
    clearError();

    // create query
    const queryParams = {
        select_type: document.querySelector('input[name="selectType"]:checked').value,
        columns: [],
        aggregate_function: null,
        where_conditions: [],
        order_by: null,
        limit: null
    };

    // get SELECT info
    if (queryParams.select_type === 'columns') {
        queryParams.columns = Array.from(document.getElementById('selectColumns').selectedOptions).map(opt => opt.value);

        if (queryParams.columns.length === 0) {
            queryParams.select_type = 'all';
        }
    } else if (queryParams.select_type === 'aggregate') {
        queryParams.aggregate_function = document.getElementById('aggregateFunction').value;
        queryParams.aggregate_column = document.getElementById('aggregateColumn').value;
    }

    // get WHERE info
    if (document.getElementById('useWhere').checked) {
        document.querySelectorAll('.where-condition').forEach((condDiv, idx) => {
            const column = condDiv.querySelector('.where-column').value;
            const operator = condDiv.querySelector('.where-operator').value;
            
            let condition = {
                column: column,
                operator: operator
            };
            
            // Get connector (AND/OR) if not the first condition
            if (idx > 0) {
                const connectorSelect = condDiv.querySelector('.where-connector');
                if (connectorSelect) {
                    condition.connector = connectorSelect.value;
                }
            }
            
            if (operator === 'BETWEEN') {
                const lowerInput = condDiv.querySelector('.between-lower');
                const upperInput = condDiv.querySelector('.between-upper');
                if (lowerInput && upperInput && lowerInput.value && upperInput.value) {
                    condition.value = `${lowerInput.value} AND ${upperInput.value}`;
                    queryParams.where_conditions.push(condition);
                }
            } else if (operator === 'IN') {
                const inInput = condDiv.querySelector('.in-values');
                if (inInput && inInput.value) {
                    condition.value = inInput.value;
                    queryParams.where_conditions.push(condition);
                }
            } else {
                const value = condDiv.querySelector('.where-value').value;
                if (value) {
                    condition.value = value;
                    queryParams.where_conditions.push(condition);
                }
            }
        });
    }
    
    // Get ORDER BY
    if (document.getElementById('useOrderBy').checked) {
        queryParams.order_by = {
            column: document.getElementById('orderByColumn').value,
            direction: document.getElementById('orderByDirection').value
        };
    }
    
    // Get LIMIT
    if (document.getElementById('useLimit').checked) {
        const limitValue = document.getElementById('limitValue').value;
        if (limitValue) {
            queryParams.limit = parseInt(limitValue);
        }
    }
    
    console.log('Executing query with params:', queryParams);
    
    try {
        const response = await fetch(`/api/tables/${tableName}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(queryParams)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to execute query');
        }
        
        const result = await response.json();
        
        // close query builder
        closeQueryBuilder();
        
        // hide search box for query results
        document.getElementById('searchContainer').style.display = 'none';
        
        // show results
        displayQueryResults(result);
        
    } catch (error) {
        showError('Error executing query: ' + error.message);
    }
}

// JOIN FUNCTIONS ---------------------------------------------------------------------------------------------------
function openJoinBuilder() {
    // get available tables
    fetch('/api/tables')
    .then(response => response.json())
    .then(tables => {
        const modal = createJoinBuilderModal(tables);
        document.body.appendChild(modal);
    })
    .catch(error => {
        showError('Error loading tables: ' + error.message);
    });
}

// create JOIN builder
function createJoinBuilderModal(tables) {
    const modal = document.createElement('div');
    modal.className = 'join-modal';
    modal.id = 'joinModal';

    let html = `
        <div class="join-modal-content">
            <div class="join-modal-header">
                <h2>Join Tables Builder</h2>
                <button class="close-btn" onclick="closeJoinBuilder()">&times;</button>
            </div>
            
            <!-- Table Selection -->
            <div class="join-section">
                <h3>1. Select Tables to Join</h3>
                <p class="join-section-description">Choose two tables to combine (joined on Facility_ID)</p>
                
                <div class="join-option">
                    <label for="joinTable1">First Table:</label>
                    <select id="joinTable1">
                        <option value="">-- Select first table --</option>
                        ${tables.map(t => `<option value="${t}">${formatTableName(t)}</option>`).join('')}
                    </select>
                </div>
                
                <div class="join-option">
                    <label for="joinType">Join Type:</label>
                    <select id="joinType">
                        <option value="INNER">INNER JOIN - Only matching rows from both tables</option>
                        <option value="LEFT">LEFT JOIN - All rows from first table, matching from second</option>
                        <option value="RIGHT">RIGHT JOIN - All rows from second table, matching from first</option>
                    </select>
                </div>
                
                <div class="join-option">
                    <label for="joinTable2">Second Table:</label>
                    <select id="joinTable2">
                        <option value="">-- Select second table --</option>
                        ${tables.map(t => `<option value="${t}">${formatTableName(t)}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <!-- Column Selection -->
            <div class="join-section" id="columnSelectionSection" style="display: none;">
                <h3>2. Select Columns</h3>
                <p class="join-section-description">Choose which columns to include in the results</p>
                
                <div id="table1Columns" class="column-selector" style="display: none;">
                    <button class="select-all-btn" onclick="toggleAllColumns('table1', true)">Select All</button>
                    <button class="select-all-btn" onclick="toggleAllColumns('table1', false)">Deselect All</button>
                    <h4 id="table1ColumnsTitle">Columns from Table 1</h4>
                    <div id="table1ColumnsList" class="column-checkboxes"></div>
                </div>
                
                <div id="table2Columns" class="column-selector" style="display: none;">
                    <button class="select-all-btn" onclick="toggleAllColumns('table2', true)">Select All</button>
                    <button class="select-all-btn" onclick="toggleAllColumns('table2', false)">Deselect All</button>
                    <h4 id="table2ColumnsTitle">Columns from Table 2</h4>
                    <div id="table2ColumnsList" class="column-checkboxes"></div>
                </div>
            </div>
            
            <!-- Optional Filters -->
            <div class="join-section" id="joinFiltersSection" style="display: none;">
                <h3>3. Optional Filters & Grouping</h3>
                
                <div class="checkbox-group" style="margin-bottom: 15px;">
                    <input type="checkbox" id="useGroupBy">
                    <label for="useGroupBy">Group results by Facility_ID</label>
                </div>
                
                <div id="groupByOptions" style="display: none; background: #f8fbff; padding: 20px; border-radius: 12px; border: 1px solid #e0eaf8; margin-bottom: 20px;">
                    <p style="color: #666; font-size: 0.9em; margin-bottom: 15px;">
                        💡 When grouping, numeric columns will be aggregated. Choose how to aggregate them:
                    </p>
                    <div class="join-option">
                        <label>Aggregate Function:</label>
                        <select id="aggregateFunc">
                            <option value="AVG">AVG - Average value</option>
                            <option value="SUM">SUM - Total sum</option>
                            <option value="COUNT">COUNT - Count of records</option>
                            <option value="MIN">MIN - Minimum value</option>
                            <option value="MAX">MAX - Maximum value</option>
                        </select>
                    </div>
                    <p style="color: #666; font-size: 0.85em; margin-top: 10px;">
                        Note: Non-numeric columns will use the first value found for each facility.
                    </p>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="useJoinLimit">
                    <label for="useJoinLimit">Limit results</label>
                </div>
                
                <div id="joinLimitOptions" style="display: none; margin-top: 15px;">
                    <input type="number" id="joinLimitValue" min="1" value="100" placeholder="Number of rows" style="width: 200px; padding: 10px; border: 2px solid #e0eaf8; border-radius: 8px;">
                </div>
            </div>
            <!-- Query Preview -->
            <div class="join-section">
                <h3>Query Preview</h3>
                <div class="join-preview" id="joinPreview">
                    Select tables to see preview...
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="join-actions">
                <button class="cancel-btn" onclick="closeJoinBuilder()">Cancel</button>
                <button class="execute-join-btn" onclick="executeJoin()">Execute Join</button>
            </div>
        </div>
    `;

    modal.innerHTML = html;

    setTimeout(() => setupJoinBuilderListeners(), 0);

    return modal;
}

// Setup event listeners for join builder
function setupJoinBuilderListeners() {
    const table1Select = document.getElementById('joinTable1');
    const table2Select = document.getElementById('joinTable2');
    const joinTypeSelect = document.getElementById('joinType');
    const useGroupByCheckbox = document.getElementById('useGroupBy');
    const groupByOptions = document.getElementById('groupByOptions');
    const aggregateFunc = document.getElementById('aggregateFunc');
    const useLimitCheckbox = document.getElementById('useJoinLimit');
    const limitOptions = document.getElementById('joinLimitOptions');
    const limitValue = document.getElementById('joinLimitValue');
    
    // When table 1 is selected, load its columns
    table1Select.addEventListener('change', async function() {
        if (this.value) {
            await loadTableColumns('table1', this.value);
            
            // If table 2 is already selected and it's the same, clear it
            if (table2Select.value && table2Select.value === this.value) {
                showError('Cannot join a table with itself. Please select a different second table.');
                table2Select.value = '';
                document.getElementById('table2Columns').style.display = 'none';
            }
            
            updateJoinPreview();
        }
    });
    
    // When table 2 is selected, load its columns
    table2Select.addEventListener('change', async function() {
        if (this.value) {
            // Prevent selecting the same table twice
            const table1Value = table1Select.value;
            if (this.value === table1Value) {
                showError('Cannot join a table with itself. Please select a different table.');
                this.value = '';
                return;
            }
            await loadTableColumns('table2', this.value);
            updateJoinPreview();
        }
    });
    
    // When join type changes
    joinTypeSelect.addEventListener('change', function() {
        updateJoinPreview();
    });

    // Group By checkbox
    useGroupByCheckbox.addEventListener('change', function() {
        groupByOptions.style.display = this.checked ? 'block' : 'none';
        updateJoinPreview();
    });
    
    // Aggregate function change
    aggregateFunc.addEventListener('change', function() {
        updateJoinPreview();
    });
    
    // Limit checkbox
    useLimitCheckbox.addEventListener('change', function() {
        limitOptions.style.display = this.checked ? 'block' : 'none';
        updateJoinPreview();
    });
    
    limitValue.addEventListener('input', function() {
        updateJoinPreview();
    });
}

async function loadTableColumns(tableNum, tableName) {
    try {
        const response = await fetch(`/api/tables/${tableName}/info`);
        const info = await response.json();

        const columnsList = document.getElementById(`${tableNum}ColumnsList`);
        const columnsContainer = document.getElementById(`${tableNum}Columns`);
        const columnsTitle = document.getElementById(`${tableNum}ColumnsTitle`);

        // update title
        columnsTitle.textContent = `Columns from ${formatTableName(tableName)}`;

        // clear prev. characters
        columnsList.innerHTML = '';

        // add checkboxes for each column to include or exclude
        info.columns.forEach(col => {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'column-checkbox';
            checkboxDiv.innerHTML = `
                <input type="checkbox" id="${tableNum}_${col.name}" value="${col.name}" class="${tableNum}-column" checked onchange="updateJoinPreview()">
                <label for="${tableNum}_${col.name}">${col.name}</label>
            `;
            columnsList.appendChild(checkboxDiv);
        });

        // Show the columns container
        columnsContainer.style.display = 'block';
        
        // Show column selection section if both tables have columns
        const table1Visible = document.getElementById('table1Columns').style.display !== 'none';
        const table2Visible = document.getElementById('table2Columns').style.display !== 'none';
        
        if (table1Visible && table2Visible) {
            document.getElementById('columnSelectionSection').style.display = 'block';
            document.getElementById('joinFiltersSection').style.display = 'block';
        }
    }

    catch (error) {
        showError('Error loading columns: ' + error.message);
    }
}

// enable toggling of columns
function toggleAllColumns(tableNum, checked) {
    const checkboxes = document.querySelectorAll(`.${tableNum}-column`);
    checkboxes.forEach(cb => {
        cb.checked = checked;
    });
    updateJoinPreview();
}

// Update join preview
function updateJoinPreview() {
    const preview = document.getElementById('joinPreview');
    if (!preview) return;
    
    const table1 = document.getElementById('joinTable1').value;
    const table2 = document.getElementById('joinTable2').value;
    const joinType = document.getElementById('joinType').value;
    
    if (!table1 || !table2) {
        preview.textContent = 'Select both tables to see preview...';
        return;
    }
    
    // Get selected columns
    const table1Columns = Array.from(document.querySelectorAll('.table1-column:checked'))
        .map(cb => `${table1}.${cb.value}`);
    const table2Columns = Array.from(document.querySelectorAll('.table2-column:checked'))
        .map(cb => `${table2}.${cb.value}`);
    
    const allColumns = [...table1Columns, ...table2Columns];
    
    if (allColumns.length === 0) {
        preview.textContent = 'Select at least one column...';
        return;
    }

    // Check if grouping
    const useGroupBy = document.getElementById('useGroupBy').checked;
    const aggregateFunc = document.getElementById('aggregateFunc').value;
    
    let selectColumns = [];
    
    if (useGroupBy) {
        // Add Facility_ID (the grouping column)
        selectColumns.push(`${table1}.Facility_ID`);
        
        // Add other columns with aggregation for numeric ones
        table1Columns.forEach(col => {
            if (col !== 'Facility_ID') {
                // Assume text columns use MAX (will show first/last value)
                selectColumns.push(`MAX(${table1}.${col}) as ${col}`);
            }
        });
        
        table2Columns.forEach(col => {
            if (col !== 'Facility_ID') {
                // Apply aggregate function to numeric-looking columns
                if (col.toLowerCase().includes('score') || 
                    col.toLowerCase().includes('count') || 
                    col.toLowerCase().includes('number') ||
                    col.toLowerCase().includes('rating')) {
                    selectColumns.push(`${aggregateFunc}(${table2}.${col}) as ${col}_${aggregateFunc.toLowerCase()}`);
                } else {
                    selectColumns.push(`MAX(${table2}.${col}) as ${col}`);
                }
            }
        });
    } else {
        // No grouping - regular columns
        table1Columns.forEach(col => {
            selectColumns.push(`${table1}.${col}`);
        });
        table2Columns.forEach(col => {
            selectColumns.push(`${table2}.${col}`);
        });
    }
    
    let query = `SELECT\n  ${allColumns.join(',\n  ')}\nFROM ${table1}\n${joinType} JOIN ${table2}\n  ON ${table1}.Facility_ID = ${table2}.Facility_ID`;
    
    // Add GROUP BY if checked
    if (useGroupBy) {
        query += `\nGROUP BY ${table1}.Facility_ID`;
    }

    // Add LIMIT if checked
    const useLimit = document.getElementById('useJoinLimit').checked;
    if (useLimit) {
        const limitValue = document.getElementById('joinLimitValue').value;
        if (limitValue) {
            query += `\nLIMIT ${limitValue}`;
        }
    }
    
    query += ';';
    
    preview.textContent = query;
}

// Close join builder
function closeJoinBuilder() {
    const modal = document.getElementById('joinModal');
    if (modal) {
        modal.remove();
    }
}

// Execute the join
async function executeJoin() {
    clearError();
    
    const table1 = document.getElementById('joinTable1').value;
    const table2 = document.getElementById('joinTable2').value;
    const joinType = document.getElementById('joinType').value;
    
    if (!table1 || !table2) {
        showError('Please select both tables');
        return;
    }
    
    // Get selected columns
    const table1Columns = Array.from(document.querySelectorAll('.table1-column:checked'))
        .map(cb => cb.value);
    const table2Columns = Array.from(document.querySelectorAll('.table2-column:checked'))
        .map(cb => cb.value);
    
    if (table1Columns.length === 0 && table2Columns.length === 0) {
        showError('Please select at least one column');
        return;
    }
    
    const joinParams = {
        table1: table1,
        table2: table2,
        join_type: joinType,
        table1_columns: table1Columns,
        table2_columns: table2Columns,
        use_group_by: document.getElementById('useGroupBy').checked,
        aggregate_function: document.getElementById('aggregateFunc').value,
        limit: null
    };
    
    // Add limit if checked
    if (document.getElementById('useJoinLimit').checked) {
        const limitValue = document.getElementById('joinLimitValue').value;
        if (limitValue) {
            joinParams.limit = parseInt(limitValue);
        }
    }
    
    console.log('Executing join with params:', joinParams);
    
    try {
        const response = await fetch('/api/tables/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(joinParams)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to execute join');
        }
        
        const result = await response.json();
        
        // Close the join builder
        closeJoinBuilder();
        
        // Hide search box for join results
        document.getElementById('searchContainer').style.display = 'none';
        
        // Display results
        displayJoinResults(result);
        
    } catch (error) {
        showError('Error executing join: ' + error.message);
    }
}

// Display join results
function displayJoinResults(result) {
    tableContainer.classList.remove('empty');
    
    if (!result.rows || result.rows.length === 0) {
        tableContainer.innerHTML = '<p class="empty">Join returned no results.</p>';
        tableContainer.classList.add('empty');
        return;
    }
    
    let html = '<div style="background: #f8fbff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0eaf8;">';
    html += '<h3 style="margin: 0 0 10px 0; color: #9be7c1;">Join Results</h3>';
    html += `<p style="margin: 0; color: #666;"><strong>Query:</strong> ${result.query}</p>`;
    html += '</div>';
    
    html += '<table>';
    
    // Header
    html += '<tr>';
    result.columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr>';
    
    // Rows
    result.rows.forEach(row => {
        html += '<tr>';
        result.columns.forEach(col => {
            const value = row[col] !== null && row[col] !== undefined ? row[col] : '<em style="color: #999;">NULL</em>';
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</table>';
    html += `<div class="row-count">Total rows: ${result.total_rows}</div>`;
    
    tableContainer.innerHTML = html;
}



// display query results
function displayQueryResults(result) {
    tableContainer.classList.remove('empty');

    if (!result.rows || result.rows.length === 0) {
        tableContainer.innerHTML = '<p class="empty">Query returned no results.</p>';
        tableContainer.classList.add('empty');
        return;
    }

    let html = '<div style="background: #f8f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">';
    html += '<h3 style="margin: 0 0 10px 0; color: #667eea;">Query Results</h3>';
    html += `<p style="margin: 0; color: #666;"><strong>Query:</strong> ${result.query}</p>`;
    html += '</div>';
    
    html += '<table>';
    
    // Header
    html += '<tr>';
    result.columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr>';
    
    // Rows
    result.rows.forEach(row => {
        html += '<tr>';
        result.columns.forEach(col => {
            const value = row[col] !== null && row[col] !== undefined ? row[col] : '<em style="color: #999;">NULL</em>';
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</table>';
    html += `<div class="row-count">Total rows: ${result.total_rows}</div>`;
    
    tableContainer.innerHTML = html;
}


// Load tables when page loads
loadTables();

queryBtn.addEventListener('click', function() {
    const tableName = tableSelect.value;
    if (!tableName) return;

    openQueryBuilder(tableName);
});

joinBtn.addEventListener('click', function() {
    openJoinBuilder();
});