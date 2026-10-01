-- Reports, plates and their boxes as one JSON array, for build_dataset.py:
--   docker exec -i facefinder-postgres psql -U facefinder -d peoples_lpr -At < export_reports.sql > reports.json
select coalesce(json_agg(json_build_object(
  'id', r.id, 'photos', r.photos, 'extra', r.extra_boxes,
  'plates', (select json_agg(json_build_object('crop', p.crop, 'photo', p.photo, 'box', p.box,
                                               'text', p.prefix || p.number) order by p.position)
             from plates p where p.report_id = r.id))), '[]')
from reports r;
