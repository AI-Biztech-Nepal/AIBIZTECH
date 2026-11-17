-- Product renamed: Auto Stock Manager is now Stock Manager
update core.services set name = 'Stock Manager' where key = 'stock';
